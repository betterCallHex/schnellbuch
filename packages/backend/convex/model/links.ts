import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { UserMutationCtx } from "../functions";
import { listBookmarks } from "./bookmarks";
import { listFolders } from "./folders";
import { buildFolderTree, flattenFolderTree } from "./tree";

export type LinkStatus = "ok" | "gone" | "unsure";

const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;
const HTTP_BAD_REQUEST = 400;

// 404 and 410 mean the page is gone. Anything else 4xx/5xx (blocked bots,
// rate limits, outages) can't be told apart from a working page, so it's
// "unsure" rather than a reason to delete.
export function classifyResponse(httpStatus: number): LinkStatus {
  if (httpStatus === HTTP_NOT_FOUND || httpStatus === HTTP_GONE) {
    return "gone";
  }
  return httpStatus < HTTP_BAD_REQUEST ? "ok" : "unsure";
}

// A timeout may be a slow server; any other network failure (no DNS
// record, refused connection, bad certificate) means the site is gone.
export function classifyFailure(error: unknown): LinkStatus {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError" ? "unsure" : "gone";
}

// Links checked together by one action, in parallel.
export const LINK_CHECK_BATCH_SIZE = 20;
const BATCH_SPACING_MS = 5000;
// A link is checked at most once an hour, however often an agent asks.
const RECHECK_AFTER_MS = 60 * 60 * 1000;

// Queues the least recently checked bookmarks (never checked first) for a
// background check. Results land on each bookmark; find_broken_links reads
// them.
export async function queueLinkChecks(
  ctx: UserMutationCtx,
  {
    folderId,
    limit,
  }: { folderId: Id<"folders"> | null | undefined; limit: number }
) {
  const all = await listBookmarks(ctx);
  const inScope = await scopeTo(ctx, all, folderId);
  const recently = Date.now() - RECHECK_AFTER_MS;
  const queue = inScope
    // Agents' links are never fetched (see urlFromAgent).
    .filter(
      (bookmark) =>
        !bookmark.urlFromAgent &&
        (bookmark.linkCheck?.checkedAt ?? 0) < recently
    )
    .toSorted(
      (first, second) =>
        (first.linkCheck?.checkedAt ?? 0) - (second.linkCheck?.checkedAt ?? 0)
    )
    .slice(0, limit)
    .map((bookmark) => bookmark._id);
  for (let index = 0; index < queue.length; index += LINK_CHECK_BATCH_SIZE) {
    // biome-ignore lint/performance/noAwaitInLoops: scheduling is a cheap write; batches are spaced in time
    await ctx.scheduler.runAfter(
      (index / LINK_CHECK_BATCH_SIZE) * BATCH_SPACING_MS,
      internal.links.checkBatch,
      {
        userId: ctx.userId,
        bookmarkIds: queue.slice(index, index + LINK_CHECK_BATCH_SIZE),
      }
    );
  }
  const seconds = Math.ceil(
    (queue.length / LINK_CHECK_BATCH_SIZE) * (BATCH_SPACING_MS / 1000)
  );
  return {
    queued: queue.length,
    message:
      queue.length === 0
        ? "No bookmarks to check: links are checked at most once an hour, and links an agent saved are never opened by SchnellBuch."
        : `Checking ${queue.length} links in the background. Call find_broken_links in about ${Math.max(seconds, 10)} seconds.`,
  };
}

async function scopeTo<
  Bookmark extends {
    folderId?: Id<"folders">;
    urlFromAgent?: true;
    linkCheck?: { checkedAt: number };
  },
>(
  ctx: UserMutationCtx,
  all: Bookmark[],
  folderId: Id<"folders"> | null | undefined
) {
  if (folderId === undefined) {
    return all;
  }
  if (folderId === null) {
    return all.filter((bookmark) => !bookmark.folderId);
  }
  const node = flattenFolderTree(buildFolderTree(await listFolders(ctx))).find(
    (folder) => folder._id === folderId
  );
  const inside = new Set(
    node ? flattenFolderTree([node]).map((folder) => folder._id) : []
  );
  return all.filter(
    (bookmark) => bookmark.folderId && inside.has(bookmark.folderId)
  );
}
