import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { UserMutationCtx, UserQueryCtx } from "../functions";
import {
  cleanFolderMark,
  type FolderColor,
  type FolderMark,
  folderColor,
  folderMark,
} from "./style";
import { isWithinFolder, parentLookup } from "./tree";

export const createFolderArgs = {
  name: v.string(),
  parentId: v.optional(v.id("folders")),
  color: v.optional(folderColor),
  mark: v.optional(folderMark),
};

export const updateFolderArgs = {
  folderId: v.id("folders"),
  name: v.optional(v.string()),
  parentId: v.optional(v.union(v.id("folders"), v.null())),
  color: v.optional(v.union(folderColor, v.null())),
  mark: v.optional(v.union(folderMark, v.null())),
};

export const deleteFolderArgs = { folderId: v.id("folders") };

export const duplicateFolderArgs = {
  folderId: v.id("folders"),
  parentId: v.optional(v.id("folders")),
};

const MAX_ITEMS_COPIED = 4000;

export function listFolders(ctx: UserQueryCtx) {
  return ctx.db
    .query("folders")
    .withIndex("by_user_parent", (q) => q.eq("userId", ctx.userId))
    .collect();
}

export async function createFolder(
  ctx: UserMutationCtx,
  {
    name,
    parentId,
    color,
    mark,
  }: {
    name: string;
    parentId?: Id<"folders">;
    color?: FolderColor;
    mark?: FolderMark;
  }
) {
  if (parentId) {
    await getOwnedFolder(ctx, parentId);
  }
  return ctx.db.insert("folders", {
    userId: ctx.userId,
    name: cleanFolderName(name),
    parentId,
    color,
    mark: mark && cleanFolderMark(mark),
  });
}

export async function updateFolder(
  ctx: UserMutationCtx,
  {
    folderId,
    name,
    parentId,
    color,
    mark,
  }: {
    folderId: Id<"folders">;
    name?: string;
    parentId?: Id<"folders"> | null;
    color?: FolderColor | null;
    mark?: FolderMark | null;
  }
) {
  await getOwnedFolder(ctx, folderId);
  await ctx.db.patch(folderId, {
    ...(name === undefined ? {} : { name: cleanFolderName(name) }),
    ...(color === undefined ? {} : { color: color ?? undefined }),
    ...(mark === undefined
      ? {}
      : { mark: mark === null ? undefined : cleanFolderMark(mark) }),
  });
  if (parentId !== undefined) {
    await moveFolder(ctx, folderId, parentId ?? undefined);
  }
}

export async function deleteFolder(
  ctx: UserMutationCtx,
  { folderId }: { folderId: Id<"folders"> }
) {
  const folder = await getOwnedFolder(ctx, folderId);
  const childFolders = await ctx.db
    .query("folders")
    .withIndex("by_user_parent", (q) =>
      q.eq("userId", ctx.userId).eq("parentId", folderId)
    )
    .collect();
  const bookmarks = await ctx.db
    .query("bookmarks")
    .withIndex("by_user_folder", (q) =>
      q.eq("userId", ctx.userId).eq("folderId", folderId)
    )
    .collect();
  await Promise.all([
    ...childFolders.map((child) =>
      ctx.db.patch(child._id, { parentId: folder.parentId })
    ),
    ...bookmarks.map((bookmark) =>
      ctx.db.patch(bookmark._id, { folderId: folder.parentId })
    ),
  ]);
  await ctx.db.delete(folderId);
}

export async function duplicateFolder(
  ctx: UserMutationCtx,
  { folderId, parentId }: { folderId: Id<"folders">; parentId?: Id<"folders"> }
) {
  const original = await getOwnedFolder(ctx, folderId);
  if (parentId) {
    await getOwnedFolder(ctx, parentId);
    await assertOutsideFolder(ctx, parentId, folderId);
  }
  const subtree = await collectSubtree(ctx, original);
  if (subtree.folders.length + subtree.bookmarks.length > MAX_ITEMS_COPIED) {
    throw new ConvexError(
      `That folder holds more than ${MAX_ITEMS_COPIED} items, too many to copy at once.`
    );
  }
  return await copyFolderInto(ctx, original, {
    parentId,
    name: copyName(original, parentId),
  });
}

export async function deleteFolderWithContents(
  ctx: UserMutationCtx,
  { folderId }: { folderId: Id<"folders"> }
) {
  const subtree = await collectSubtree(
    ctx,
    await getOwnedFolder(ctx, folderId)
  );
  await Promise.all([
    ...subtree.bookmarks.map((bookmark) => ctx.db.delete(bookmark._id)),
    ...subtree.folders.map((folder) => ctx.db.delete(folder._id)),
  ]);
}

export async function getOwnedFolder(
  ctx: UserQueryCtx,
  folderId: Id<"folders">
) {
  const folder = await ctx.db.get(folderId);
  if (!folder || folder.userId !== ctx.userId) {
    throw new ConvexError("Folder not found.");
  }
  return folder;
}

async function moveFolder(
  ctx: UserMutationCtx,
  folderId: Id<"folders">,
  parentId: Id<"folders"> | undefined
) {
  if (parentId) {
    await getOwnedFolder(ctx, parentId);
    await assertOutsideFolder(ctx, parentId, folderId);
  }
  await ctx.db.patch(folderId, { parentId });
}

async function assertOutsideFolder(
  ctx: UserQueryCtx,
  candidateId: Id<"folders">,
  folderId: Id<"folders">
) {
  const parentOf = parentLookup(await listFolders(ctx));
  if (isWithinFolder(parentOf, candidateId, folderId)) {
    throw new ConvexError("A folder can't move inside itself.");
  }
}

const MAX_FOLDER_NAME_LENGTH = 200;

function cleanFolderName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ConvexError("Folder name can't be empty.");
  }
  if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
    throw new ConvexError(
      `A folder name can be at most ${MAX_FOLDER_NAME_LENGTH} characters.`
    );
  }
  return trimmed;
}

function copyName(
  original: Doc<"folders">,
  parentId: Id<"folders"> | undefined
) {
  return original.parentId === parentId
    ? cleanFolderName(`${original.name} copy`)
    : original.name;
}

async function copyFolderInto(
  ctx: UserMutationCtx,
  folder: Doc<"folders">,
  placement: { parentId: Id<"folders"> | undefined; name: string }
): Promise<Id<"folders">> {
  const copyId = await ctx.db.insert("folders", {
    userId: ctx.userId,
    name: placement.name,
    parentId: placement.parentId,
    color: folder.color,
    mark: folder.mark,
  });
  const contents = await folderContents(ctx, folder._id);
  await Promise.all([
    ...contents.bookmarks.map(({ _id, _creationTime, ...bookmark }) =>
      ctx.db.insert("bookmarks", { ...bookmark, folderId: copyId })
    ),
    ...contents.folders.map((child) =>
      copyFolderInto(ctx, child, { parentId: copyId, name: child.name })
    ),
  ]);
  return copyId;
}

async function collectSubtree(ctx: UserQueryCtx, root: Doc<"folders">) {
  const folders: Doc<"folders">[] = [];
  const bookmarks: Doc<"bookmarks">[] = [];
  let level = [root];
  while (level.length > 0) {
    folders.push(...level);
    // biome-ignore lint/performance/noAwaitInLoops: each level is found from the one above it
    const contents = await Promise.all(
      level.map((folder) => folderContents(ctx, folder._id))
    );
    level = contents.flatMap((content) => content.folders);
    bookmarks.push(...contents.flatMap((content) => content.bookmarks));
  }
  return { folders, bookmarks };
}

// The folders and bookmarks directly inside a folder.
export async function folderContents(
  ctx: UserQueryCtx,
  folderId: Id<"folders">
) {
  const [folders, bookmarks] = await Promise.all([
    ctx.db
      .query("folders")
      .withIndex("by_user_parent", (q) =>
        q.eq("userId", ctx.userId).eq("parentId", folderId)
      )
      .collect(),
    ctx.db
      .query("bookmarks")
      .withIndex("by_user_folder", (q) =>
        q.eq("userId", ctx.userId).eq("folderId", folderId)
      )
      .collect(),
  ]);
  return { folders, bookmarks };
}
