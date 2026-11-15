import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { UserMutationCtx, UserQueryCtx } from "../functions";
import { getOwnedFolder } from "./folders";
import { normalizeUrl, placeholderTitle } from "./url";

export const addBookmarkArgs = {
  url: v.string(),
  title: v.optional(v.string()),
  folderId: v.optional(v.id("folders")),
  // Restoring a deleted bookmark keeps its original date.
  savedAt: v.optional(v.number()),
};

export const updateBookmarkArgs = {
  bookmarkId: v.id("bookmarks"),
  url: v.optional(v.string()),
  title: v.optional(v.string()),
  folderId: v.optional(v.union(v.id("folders"), v.null())),
};

export const deleteBookmarkArgs = { bookmarkId: v.id("bookmarks") };

export async function listBookmarks(ctx: UserQueryCtx) {
  const bookmarks = await ctx.db
    .query("bookmarks")
    .withIndex("by_user_folder", (q) => q.eq("userId", ctx.userId))
    .collect();
  return bookmarks.sort(newestFirst);
}

export function savedAtOf(bookmark: Doc<"bookmarks">) {
  return bookmark.savedAt ?? bookmark._creationTime;
}

export function newestFirst(first: Doc<"bookmarks">, second: Doc<"bookmarks">) {
  return savedAtOf(second) - savedAtOf(first);
}

export async function addBookmark(
  ctx: UserMutationCtx,
  {
    url,
    title,
    folderId,
    savedAt,
  }: {
    url: string;
    title?: string;
    folderId?: Id<"folders">;
    savedAt?: number;
  }
) {
  const normalizedUrl = normalizeUrl(url);
  if (folderId) {
    await getOwnedFolder(ctx, folderId);
  }
  const bookmarkId = await ctx.db.insert("bookmarks", {
    userId: ctx.userId,
    url: normalizedUrl,
    title: title?.trim() || placeholderTitle(normalizedUrl),
    folderId,
    savedAt: savedAt ?? Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.metadata.fetchMetadata, {
    bookmarkId,
  });
  return bookmarkId;
}

export async function updateBookmark(
  ctx: UserMutationCtx,
  {
    bookmarkId,
    url,
    title,
    folderId,
  }: {
    bookmarkId: Id<"bookmarks">;
    url?: string;
    title?: string;
    folderId?: Id<"folders"> | null;
  }
) {
  await getOwnedBookmark(ctx, bookmarkId);
  if (folderId) {
    await getOwnedFolder(ctx, folderId);
  }
  await ctx.db.patch(bookmarkId, {
    ...(url === undefined ? {} : { url: normalizeUrl(url) }),
    ...(title === undefined ? {} : { title: cleanTitle(title) }),
    ...(folderId === undefined ? {} : { folderId: folderId ?? undefined }),
  });
}

export async function deleteBookmark(
  ctx: UserMutationCtx,
  { bookmarkId }: { bookmarkId: Id<"bookmarks"> }
) {
  await getOwnedBookmark(ctx, bookmarkId);
  await ctx.db.delete(bookmarkId);
}

async function getOwnedBookmark(
  ctx: UserQueryCtx,
  bookmarkId: Id<"bookmarks">
) {
  const bookmark = await ctx.db.get(bookmarkId);
  if (!bookmark || bookmark.userId !== ctx.userId) {
    throw new ConvexError("Bookmark not found.");
  }
  return bookmark;
}

function cleanTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new ConvexError("Title can't be empty.");
  }
  return trimmed;
}
