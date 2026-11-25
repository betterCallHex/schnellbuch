import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  agentMutation,
  agentQuery,
  type UserMutationCtx,
  type UserQueryCtx,
} from "./functions";
import * as bookmarks from "./model/bookmarks";
import * as changes from "./model/changes";
import { describeFolders, describeLibrary } from "./model/describe";
import { findDuplicateGroups } from "./model/duplicates";
import * as folders from "./model/folders";
import { queueLinkChecks } from "./model/links";
import { searchBookmarks as rankBookmarks } from "./model/search";
import { cleanTags, splitTags, storedTags, tagsOf } from "./model/tags";
import { normalizeUrl } from "./model/url";
import type { undoStep } from "./schema";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
// Bulk tools take at most this many items per call.
export const MAX_BULK_ITEMS = 200;
const MAX_DUPLICATE_GROUPS = 50;
const MAX_QUERY_LENGTH = 200;

const DEFAULT_FOLDER_LIMIT = 100;

const tagFilterArgs = {
  tags: v.optional(v.array(v.string())),
  withoutTags: v.optional(v.array(v.string())),
};

export const listFolders = agentQuery({
  args: {
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { query, limit, cursor }) => {
    const needle = (query ?? "").trim().toLowerCase();
    const matching = (await readLibrary(ctx)).folders.filter((folder) =>
      folder.path.toLowerCase().includes(needle)
    );
    const start = offsetFrom(cursor);
    const end = start + clampLimit(limit ?? DEFAULT_FOLDER_LIMIT);
    return {
      folders: matching.slice(start, end),
      nextCursor: end < matching.length ? String(end) : null,
    };
  },
});

export const listBookmarks = agentQuery({
  args: {
    folderId: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    ...tagFilterArgs,
  },
  handler: async (ctx, { folderId, limit, cursor, ...tagFilter }) => {
    const library = await readLibrary(ctx);
    const wanted = folderTarget(ctx, folderId);
    const inFolder = library.bookmarks
      .filter(
        (bookmark) =>
          wanted === undefined || (bookmark.folderId ?? null) === wanted
      )
      .filter(matchingTags(tagFilter));
    const start = offsetFrom(cursor);
    const end = start + clampLimit(limit);
    return {
      bookmarks: inFolder.slice(start, end).map(library.bookmark),
      nextCursor: end < inFolder.length ? String(end) : null,
    };
  },
});

export const searchBookmarks = agentQuery({
  args: {
    query: v.string(),
    folderId: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
    ...tagFilterArgs,
  },
  handler: async (ctx, { query, folderId, limit, ...tagFilter }) => {
    const library = await readLibrary(ctx);
    const scope = library.within(folderTarget(ctx, folderId));
    return rankBookmarks(
      scope.filter(matchingTags(tagFilter)),
      query.slice(0, MAX_QUERY_LENGTH),
      clampLimit(limit)
    ).map(library.bookmark);
  },
});

export const findDuplicates = agentQuery({
  args: {
    folderId: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { folderId, limit }) => {
    const library = await readLibrary(ctx);
    const scope = library.within(folderTarget(ctx, folderId));
    const groups = findDuplicateGroups(scope).slice(
      0,
      Math.min(clampLimit(limit), MAX_DUPLICATE_GROUPS)
    );
    return groups.map((group) => ({
      bookmarks: group.bookmarks.map(library.bookmark),
    }));
  },
});

export const findBrokenLinks = agentQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const library = await readLibrary(ctx);
    const broken = library.bookmarks.filter(
      (bookmark) => bookmark.linkCheck && bookmark.linkCheck.status !== "ok"
    );
    const checked = library.bookmarks.filter((bookmark) => bookmark.linkCheck);
    return {
      checkedCount: checked.length,
      bookmarks: broken
        .toSorted(
          (first, second) =>
            Number(second.linkCheck?.status === "gone") -
            Number(first.linkCheck?.status === "gone")
        )
        .slice(0, clampLimit(limit))
        .map((bookmark) => ({
          ...library.bookmark(bookmark),
          status:
            bookmark.linkCheck?.status === "gone"
              ? ("gone" as const)
              : ("unsure" as const),
          httpStatus: bookmark.linkCheck?.httpStatus ?? null,
          checkedAt: new Date(bookmark.linkCheck?.checkedAt ?? 0).toISOString(),
        })),
    };
  },
});

export const listTags = agentQuery({
  args: {},
  handler: async (ctx) => {
    const uses = Map.groupBy(
      (await bookmarks.listBookmarks(ctx)).flatMap(tagsOf),
      (tag) => tag
    );
    return {
      tags: [...uses]
        .map(([name, tagged]) => ({ name, bookmarkCount: tagged.length }))
        .sort(
          (first, second) =>
            second.bookmarkCount - first.bookmarkCount ||
            first.name.localeCompare(second.name)
        ),
    };
  },
});

export const listChanges = agentQuery({
  args: { limit: v.optional(v.number()) },
  handler: changes.listChanges,
});

// Every write is recorded as a change, so the user sees it in Settings and
// it can be undone, whether one item or many.
export const addBookmark = agentMutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    note: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, { url, title, note, tags, folderId }) => {
    const bookmarkId = await bookmarks.addBookmark(
      ctx,
      {
        url,
        title,
        note,
        tags,
        folderId: folderId ? folderIdFrom(ctx, folderId) : undefined,
      },
      "agent"
    );
    const added = await describeBookmark(ctx, bookmarkId);
    const changeId = await changes.recordChange(
      ctx,
      `Added “${added.title}”${inFolderPhrase(added.folderPath)}`,
      [{ kind: "removeBookmark", bookmarkId }]
    );
    return { ...added, changeId };
  },
});

export const updateBookmark = agentMutation({
  args: {
    bookmarkId: v.string(),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    note: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    folderId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { bookmarkId, title, url, note, tags, folderId }) => {
    const id = bookmarkIdFrom(ctx, bookmarkId);
    const before = await bookmarks.getOwnedBookmark(ctx, id);
    await bookmarks.updateBookmark(
      ctx,
      {
        bookmarkId: id,
        title,
        url,
        note,
        tags,
        folderId: folderTarget(ctx, folderId),
      },
      "agent"
    );
    const changeId = await changes.recordChange(
      ctx,
      `Edited “${before.title}”`,
      [
        {
          kind: "editBookmark",
          bookmarkId: id,
          url: before.url,
          title: before.title,
          note: before.note,
          tags: before.tags,
          folderId: before.folderId,
          urlFromAgent: before.urlFromAgent,
        },
      ]
    );
    return { ...(await describeBookmark(ctx, id)), changeId };
  },
});

export const deleteBookmark = agentMutation({
  args: { bookmarkId: v.string() },
  handler: async (ctx, { bookmarkId }) => {
    const id = bookmarkIdFrom(ctx, bookmarkId);
    const bookmark = await bookmarks.getOwnedBookmark(ctx, id);
    await ctx.db.delete(id);
    const changeId = await changes.recordChange(
      ctx,
      `Deleted “${bookmark.title}”`,
      [changes.restoreBookmarkStep(bookmark)]
    );
    return { deletedBookmarkId: id, changeId };
  },
});

export const createFolder = agentMutation({
  args: { name: v.string(), parentId: v.optional(v.string()) },
  handler: async (ctx, { name, parentId }) => {
    const folderId = await folders.createFolder(ctx, {
      name,
      parentId: parentId ? folderIdFrom(ctx, parentId) : undefined,
    });
    const created = await describeFolder(ctx, folderId);
    const changeId = await changes.recordChange(
      ctx,
      `Created folder “${created.path}”`,
      [{ kind: "removeFolder", folderId }]
    );
    return { ...created, changeId };
  },
});

export const updateFolder = agentMutation({
  args: {
    folderId: v.string(),
    name: v.optional(v.string()),
    parentId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { folderId, name, parentId }) => {
    const id = folderIdFrom(ctx, folderId);
    const before = await folders.getOwnedFolder(ctx, id);
    await folders.updateFolder(ctx, {
      folderId: id,
      name,
      parentId: folderTarget(ctx, parentId),
    });
    const changeId = await changes.recordChange(
      ctx,
      `Changed folder “${before.name}”`,
      [
        {
          kind: "editFolder",
          folderId: id,
          name: before.name,
          parentId: before.parentId,
        },
      ]
    );
    return { ...(await describeFolder(ctx, id)), changeId };
  },
});

export const deleteFolder = agentMutation({
  args: { folderId: v.string() },
  handler: async (ctx, { folderId }) => {
    const id = folderIdFrom(ctx, folderId);
    const folder = await folders.getOwnedFolder(ctx, id);
    const contents = await folders.folderContents(ctx, id);
    await folders.deleteFolder(ctx, { folderId: id });
    const changeId = await changes.recordChange(
      ctx,
      `Deleted folder “${folder.name}”`,
      [
        {
          kind: "restoreFolder",
          name: folder.name,
          parentId: folder.parentId,
          color: folder.color,
          mark: folder.mark,
          folderIds: contents.folders.map((child) => child._id),
          bookmarkIds: contents.bookmarks.map((bookmark) => bookmark._id),
        },
      ]
    );
    return { deletedFolderId: id, changeId };
  },
});

export const addBookmarks = agentMutation({
  args: {
    bookmarks: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        note: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
    folderId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    assertBulkSize(args.bookmarks.length);
    const folderId = folderTarget(ctx, args.folderId) ?? undefined;
    if (folderId) {
      await folders.getOwnedFolder(ctx, folderId);
    }
    const addedIds: Id<"bookmarks">[] = [];
    const skipped: {
      url: string;
      reason: string;
      existingId: string | null;
    }[] = [];
    for (const { url, ...fields } of args.bookmarks) {
      // biome-ignore lint/performance/noAwaitInLoops: a link listed twice in one call must count as already saved
      const outcome = await addUnlessSaved(ctx, { url, ...fields, folderId });
      if (outcome.kind === "added") {
        addedIds.push(outcome.bookmarkId);
      } else {
        skipped.push({
          url,
          reason: outcome.reason,
          existingId: outcome.existingId,
        });
      }
    }
    const described = describeFolders(await folders.listFolders(ctx));
    const changeId =
      addedIds.length > 0
        ? await changes.recordChange(
            ctx,
            `Added ${count(addedIds.length, "bookmark")}${inFolderPhrase(described.path(folderId))}`,
            addedIds.map((bookmarkId) => ({
              kind: "removeBookmark",
              bookmarkId,
            }))
          )
        : null;
    const added = await Promise.all(addedIds.map((id) => ctx.db.get(id)));
    return {
      added: added
        .filter((bookmark) => bookmark !== null)
        .map(described.bookmark),
      skipped,
      changeId,
    };
  },
});

export const moveItems = agentMutation({
  args: {
    bookmarkIds: v.optional(v.array(v.string())),
    folderIds: v.optional(v.array(v.string())),
    toFolderId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const bookmarkIds = (args.bookmarkIds ?? []).map((id) =>
      bookmarkIdFrom(ctx, id)
    );
    const folderIds = (args.folderIds ?? []).map((id) => folderIdFrom(ctx, id));
    assertBulkSize(bookmarkIds.length + folderIds.length);
    if (bookmarkIds.length + folderIds.length === 0) {
      throw new ConvexError("Pass bookmarkIds, folderIds or both.");
    }
    const target = args.toFolderId ? folderIdFrom(ctx, args.toFolderId) : null;
    const undo: Infer<typeof undoStep>[] = [];
    for (const bookmarkId of bookmarkIds) {
      // biome-ignore lint/performance/noAwaitInLoops: each move checks ownership; any failure rolls back the whole call
      const bookmark = await bookmarks.getOwnedBookmark(ctx, bookmarkId);
      undo.push({
        kind: "moveBookmark",
        bookmarkId,
        folderId: bookmark.folderId,
      });
      await bookmarks.updateBookmark(ctx, { bookmarkId, folderId: target });
    }
    for (const folderId of folderIds) {
      // biome-ignore lint/performance/noAwaitInLoops: moves run in order so a folder can't end up inside one moved before it
      const folder = await folders.getOwnedFolder(ctx, folderId);
      undo.push({ kind: "moveFolder", folderId, parentId: folder.parentId });
      await folders.updateFolder(ctx, { folderId, parentId: target });
    }
    const described = describeFolders(await folders.listFolders(ctx));
    const what = [
      bookmarkIds.length > 0 ? count(bookmarkIds.length, "bookmark") : "",
      folderIds.length > 0 ? count(folderIds.length, "folder") : "",
    ]
      .filter(Boolean)
      .join(" and ");
    const destination = target
      ? (described.path(target) ?? "a folder")
      : "the top level";
    const changeId = await changes.recordChange(
      ctx,
      `Moved ${what} to ${destination}`,
      undo
    );
    return { movedCount: undo.length, destination, changeId };
  },
});

export const deleteBookmarks = agentMutation({
  args: { bookmarkIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const ids = [...new Set(args.bookmarkIds)].map((id) =>
      bookmarkIdFrom(ctx, id)
    );
    assertBulkSize(ids.length);
    const owned = await Promise.all(
      ids.map((bookmarkId) => bookmarks.getOwnedBookmark(ctx, bookmarkId))
    );
    await Promise.all(owned.map((bookmark) => ctx.db.delete(bookmark._id)));
    const changeId = await changes.recordChange(
      ctx,
      `Deleted ${count(owned.length, "bookmark")}`,
      owned.map(changes.restoreBookmarkStep)
    );
    return { deletedCount: owned.length, changeId };
  },
});

export const tagBookmarks = agentMutation({
  args: {
    bookmarkIds: v.array(v.string()),
    add: v.optional(v.array(v.string())),
    remove: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const ids = [...new Set(args.bookmarkIds)].map((id) =>
      bookmarkIdFrom(ctx, id)
    );
    assertBulkSize(ids.length);
    const adding = cleanTags(args.add ?? []);
    const removing = new Set(cleanTags(args.remove ?? []));
    if (adding.length + removing.size === 0) {
      throw new ConvexError("Pass the tags to add, to remove, or both.");
    }
    const owned = await Promise.all(
      ids.map((bookmarkId) => bookmarks.getOwnedBookmark(ctx, bookmarkId))
    );
    const retagged = owned
      .map((bookmark) => ({
        bookmark,
        tags: storedTags([
          ...tagsOf(bookmark).filter((tag) => !removing.has(tag)),
          ...adding,
        ]),
      }))
      .filter(({ bookmark, tags }) => !sameTags(tagsOf(bookmark), tags ?? []));
    await Promise.all(
      retagged.map(({ bookmark, tags }) => ctx.db.patch(bookmark._id, { tags }))
    );
    const changeId =
      retagged.length > 0
        ? await changes.recordChange(
            ctx,
            tagChangeSummary(adding, [...removing], retagged.length),
            retagged.map(({ bookmark }) => ({
              kind: "setTags",
              bookmarkId: bookmark._id,
              tags: bookmark.tags,
            }))
          )
        : null;
    return { changedCount: retagged.length, changeId };
  },
});

export const undoChange = agentMutation({
  args: { changeId: v.string() },
  handler: (ctx, { changeId }) => {
    const id = ctx.db.normalizeId("changes", changeId);
    if (!id) {
      throw new ConvexError(
        `No change with id ${changeId}. Call list_changes to see recent changes.`
      );
    }
    return changes.undoChange(ctx, { changeId: id });
  },
});

export const checkLinks = agentMutation({
  args: {
    folderId: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: (ctx, { folderId, limit }) =>
    queueLinkChecks(ctx, {
      folderId: folderTarget(ctx, folderId),
      limit: clampLimit(limit),
    }),
});

async function readLibrary(ctx: UserQueryCtx) {
  const [allFolders, allBookmarks] = await Promise.all([
    folders.listFolders(ctx),
    bookmarks.listBookmarks(ctx),
  ]);
  const described = describeLibrary(allFolders, allBookmarks);
  return {
    bookmarks: allBookmarks,
    ...described,
    // Bookmarks in a folder and its subfolders; undefined means everything,
    // null the top level only.
    within: (folderId: Id<"folders"> | null | undefined) => {
      if (folderId === undefined) {
        return allBookmarks;
      }
      if (folderId === null) {
        return allBookmarks.filter((bookmark) => !bookmark.folderId);
      }
      const inside = described.subtree(folderId);
      return allBookmarks.filter(
        (bookmark) => bookmark.folderId && inside.has(bookmark.folderId)
      );
    },
  };
}

async function addUnlessSaved(
  ctx: UserMutationCtx,
  {
    url,
    title,
    note,
    tags,
    folderId,
  }: {
    url: string;
    title?: string;
    note?: string;
    tags?: string[];
    folderId?: Id<"folders">;
  }
): Promise<
  | { kind: "added"; bookmarkId: Id<"bookmarks"> }
  | { kind: "skipped"; reason: string; existingId: string | null }
> {
  let normalized: string;
  try {
    normalized = normalizeUrl(url);
  } catch {
    return { kind: "skipped", reason: "not a web link", existingId: null };
  }
  const existing = await ctx.db
    .query("bookmarks")
    .withIndex("by_user_url", (q) =>
      q.eq("userId", ctx.userId).eq("url", normalized)
    )
    .first();
  if (existing) {
    return {
      kind: "skipped",
      reason: "already saved",
      existingId: existing._id,
    };
  }
  return {
    kind: "added",
    bookmarkId: await bookmarks.addBookmark(
      ctx,
      { url: normalized, title, note, tags, folderId },
      "agent"
    ),
  };
}

function matchingTags({
  tags,
  withoutTags,
}: {
  tags?: string[];
  withoutTags?: string[];
}) {
  const required = (tags ?? []).flatMap(splitTags);
  const excluded = new Set((withoutTags ?? []).flatMap(splitTags));
  return (bookmark: Doc<"bookmarks">) => {
    const own = tagsOf(bookmark);
    return (
      required.every((tag) => own.includes(tag)) &&
      !own.some((tag) => excluded.has(tag))
    );
  };
}

function sameTags(first: string[], second: string[]) {
  return (
    first.length === second.length &&
    first.every((tag, index) => tag === second[index])
  );
}

function tagChangeSummary(added: string[], removed: string[], changed: number) {
  const bookmarkCount = count(changed, "bookmark");
  if (removed.length === 0) {
    return `Tagged ${bookmarkCount} ${quoteTags(added)}`;
  }
  if (added.length === 0) {
    return `Removed ${quoteTags(removed)} from ${bookmarkCount}`;
  }
  return `Tagged ${bookmarkCount} ${quoteTags(added)}, removed ${quoteTags(removed)}`;
}

function quoteTags(tags: string[]) {
  return tags.map((tag) => `“${tag}”`).join(", ");
}

function inFolderPhrase(path: string | null | undefined) {
  return path ? ` to ${path}` : " to the top level";
}

function count(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function assertBulkSize(size: number) {
  if (size > MAX_BULK_ITEMS) {
    throw new ConvexError(
      `At most ${MAX_BULK_ITEMS} items per call. Split the list and call again.`
    );
  }
}

function offsetFrom(cursor: string | null | undefined) {
  const offset = Number(cursor ?? 0);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ConvexError(
      "That cursor isn't valid. Pass the nextCursor from the previous call."
    );
  }
  return offset;
}

async function describeBookmark(
  ctx: UserQueryCtx,
  bookmarkId: Id<"bookmarks">
) {
  const [bookmark, allFolders] = await Promise.all([
    bookmarks.getOwnedBookmark(ctx, bookmarkId),
    folders.listFolders(ctx),
  ]);
  return describeFolders(allFolders).bookmark(bookmark);
}

async function describeFolder(ctx: UserQueryCtx, folderId: Id<"folders">) {
  const [allFolders, contents] = await Promise.all([
    folders.listFolders(ctx),
    folders.folderContents(ctx, folderId),
  ]);
  const folder = describeFolders(allFolders).folder(
    folderId,
    contents.bookmarks.length
  );
  if (!folder) {
    throw new ConvexError("Folder not found.");
  }
  return folder;
}

function folderTarget(ctx: UserQueryCtx, id: string | null | undefined) {
  if (id === undefined || id === null) {
    return id;
  }
  return folderIdFrom(ctx, id);
}

function folderIdFrom(ctx: UserQueryCtx, id: string) {
  const folderId = ctx.db.normalizeId("folders", id);
  if (!folderId) {
    throw new ConvexError(
      `No folder with id ${id}. Call list_folders to see folder IDs.`
    );
  }
  return folderId;
}

function bookmarkIdFrom(ctx: UserQueryCtx, id: string) {
  const bookmarkId = ctx.db.normalizeId("bookmarks", id);
  if (!bookmarkId) {
    throw new ConvexError(
      `No bookmark with id ${id}. Call search_bookmarks or list_bookmarks to find IDs.`
    );
  }
  return bookmarkId;
}

function clampLimit(limit: number | undefined) {
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}
