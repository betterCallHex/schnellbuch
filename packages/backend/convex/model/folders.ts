import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { UserMutationCtx, UserQueryCtx } from "../functions";

export const createFolderArgs = {
  name: v.string(),
  parentId: v.optional(v.id("folders")),
};

export const updateFolderArgs = {
  folderId: v.id("folders"),
  name: v.optional(v.string()),
  parentId: v.optional(v.union(v.id("folders"), v.null())),
};

export const deleteFolderArgs = { folderId: v.id("folders") };

export function listFolders(ctx: UserQueryCtx) {
  return ctx.db
    .query("folders")
    .withIndex("by_user_parent", (q) => q.eq("userId", ctx.userId))
    .collect();
}

export async function createFolder(
  ctx: UserMutationCtx,
  { name, parentId }: { name: string; parentId?: Id<"folders"> }
) {
  if (parentId) {
    await getOwnedFolder(ctx, parentId);
  }
  return ctx.db.insert("folders", {
    userId: ctx.userId,
    name: cleanFolderName(name),
    parentId,
  });
}

export async function updateFolder(
  ctx: UserMutationCtx,
  {
    folderId,
    name,
    parentId,
  }: { folderId: Id<"folders">; name?: string; parentId?: Id<"folders"> | null }
) {
  await getOwnedFolder(ctx, folderId);
  if (name !== undefined) {
    await ctx.db.patch(folderId, { name: cleanFolderName(name) });
  }
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
  const parentById = new Map(
    (await listFolders(ctx)).map((folder) => [folder._id, folder.parentId])
  );
  let currentId: Id<"folders"> | undefined = candidateId;
  while (currentId) {
    if (currentId === folderId) {
      throw new ConvexError("A folder can't move inside itself.");
    }
    currentId = parentById.get(currentId);
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
