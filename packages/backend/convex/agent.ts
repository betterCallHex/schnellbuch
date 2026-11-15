import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { agentMutation, agentQuery, type UserQueryCtx } from "./functions";
import * as bookmarks from "./model/bookmarks";
import { describeLibrary } from "./model/describe";
import * as folders from "./model/folders";
import { searchBookmarks as rankBookmarks } from "./model/search";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export const listFolders = agentQuery({
  args: {},
  handler: async (ctx) => (await readLibrary(ctx)).folders,
});

export const listBookmarks = agentQuery({
  args: {
    folderId: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { folderId, limit }) => {
    const library = await readLibrary(ctx);
    const wanted = folderTarget(ctx, folderId);
    const inFolder =
      wanted === undefined
        ? library.bookmarks
        : library.bookmarks.filter(
            (bookmark) => (bookmark.folderId ?? null) === wanted
          );
    return inFolder.slice(0, clampLimit(limit)).map(library.bookmark);
  },
});

export const searchBookmarks = agentQuery({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit }) => {
    const library = await readLibrary(ctx);
    return rankBookmarks(library.bookmarks, query, clampLimit(limit)).map(
      library.bookmark
    );
  },
});

export const addBookmark = agentMutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, { url, title, folderId }) => {
    const bookmarkId = await bookmarks.addBookmark(ctx, {
      url,
      title,
      folderId: folderId ? folderIdFrom(ctx, folderId) : undefined,
    });
    return describeBookmark(ctx, bookmarkId);
  },
});

export const updateBookmark = agentMutation({
  args: {
    bookmarkId: v.string(),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    folderId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { bookmarkId, title, url, folderId }) => {
    const id = bookmarkIdFrom(ctx, bookmarkId);
    await bookmarks.updateBookmark(ctx, {
      bookmarkId: id,
      title,
      url,
      folderId: folderTarget(ctx, folderId),
    });
    return describeBookmark(ctx, id);
  },
});

export const deleteBookmark = agentMutation({
  args: { bookmarkId: v.string() },
  handler: async (ctx, { bookmarkId }) => {
    const id = bookmarkIdFrom(ctx, bookmarkId);
    await bookmarks.deleteBookmark(ctx, { bookmarkId: id });
    return { deletedBookmarkId: id };
  },
});

export const createFolder = agentMutation({
  args: { name: v.string(), parentId: v.optional(v.string()) },
  handler: async (ctx, { name, parentId }) => {
    const folderId = await folders.createFolder(ctx, {
      name,
      parentId: parentId ? folderIdFrom(ctx, parentId) : undefined,
    });
    return describeFolder(ctx, folderId);
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
    await folders.updateFolder(ctx, {
      folderId: id,
      name,
      parentId: folderTarget(ctx, parentId),
    });
    return describeFolder(ctx, id);
  },
});

export const deleteFolder = agentMutation({
  args: { folderId: v.string() },
  handler: async (ctx, { folderId }) => {
    const id = folderIdFrom(ctx, folderId);
    await folders.deleteFolder(ctx, { folderId: id });
    return { deletedFolderId: id };
  },
});

async function readLibrary(ctx: UserQueryCtx) {
  const [allFolders, allBookmarks] = await Promise.all([
    folders.listFolders(ctx),
    bookmarks.listBookmarks(ctx),
  ]);
  return {
    bookmarks: allBookmarks,
    ...describeLibrary(allFolders, allBookmarks),
  };
}

async function describeBookmark(
  ctx: UserQueryCtx,
  bookmarkId: Id<"bookmarks">
) {
  const library = await readLibrary(ctx);
  const bookmark = library.bookmarks.find(
    (candidate) => candidate._id === bookmarkId
  );
  if (!bookmark) {
    throw new ConvexError("Bookmark not found.");
  }
  return library.bookmark(bookmark);
}

async function describeFolder(ctx: UserQueryCtx, folderId: Id<"folders">) {
  const folder = (await readLibrary(ctx)).folder(folderId);
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
