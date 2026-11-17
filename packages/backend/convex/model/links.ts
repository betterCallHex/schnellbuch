import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { UserMutationCtx } from "../functions";
import { listBookmarks } from "./bookmarks";
import { listFolders } from "./folders";
import { enforceLimit } from "./limits";
import { fetchPool } from "./pool";
import { folderAndDescendants } from "./tree";

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

// A timeout may be a slow server, and a private or looping address wasn't
// checked at all; any other network failure (no DNS record, refused
// connection, bad certificate) means the site is gone.
const UNSURE_FAILURES = new Set([
  "TimeoutError",
  "AbortError",
  "BlockedAddressError",
]);

export function classifyFailure(error: unknown): LinkStatus {
  const name = error instanceof Error ? error.name : "";
  return UNSURE_FAILURES.has(name) ? "unsure" : "gone";
}

// Links checked together by one action, in parallel. The fetch pool runs a
// few batches at a time.
export const LINK_CHECK_BATCH_SIZE = 20;
const SECONDS_PER_BATCH = 5;
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
  await enforceLimit(ctx, "checkLinks", ctx.userId, "link checks");
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
  const batches = Array.from(
    { length: Math.ceil(queue.length / LINK_CHECK_BATCH_SIZE) },
    (_, index) =>
      queue.slice(
        index * LINK_CHECK_BATCH_SIZE,
        (index + 1) * LINK_CHECK_BATCH_SIZE
      )
  );
  await fetchPool.enqueueActionBatch(
    ctx,
    internal.links.checkBatch,
    batches.map((bookmarkIds) => ({ userId: ctx.userId, bookmarkIds }))
  );
  const seconds = batches.length * SECONDS_PER_BATCH;
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
  const inside = folderAndDescendants(await listFolders(ctx), folderId);
  return all.filter(
    (bookmark) => bookmark.folderId && inside.has(bookmark.folderId)
  );
}
