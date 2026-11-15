import { ConvexError, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { UserMutationCtx, UserQueryCtx } from "../functions";
import type { undoStep } from "../schema";
import { listFolders } from "./folders";

type UndoStep = Infer<typeof undoStep>;

const MAX_CHANGES_LISTED = 50;

export async function recordChange(
  ctx: UserMutationCtx,
  summary: string,
  undo: UndoStep[]
) {
  return await ctx.db.insert("changes", { userId: ctx.userId, summary, undo });
}

export async function listChanges(
  ctx: UserQueryCtx,
  { limit }: { limit?: number }
) {
  const changes = await ctx.db
    .query("changes")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .order("desc")
    .take(Math.min(Math.max(limit ?? 10, 1), MAX_CHANGES_LISTED));
  return changes.map((change) => ({
    id: change._id,
    summary: change.summary,
    madeAt: new Date(change._creationTime).toISOString(),
    undone: change.undoneAt !== undefined,
  }));
}

// Reverts a change set. Things deleted or moved since are handled
// gracefully: a bookmark whose folder is gone goes back to the top level.
export async function undoChange(
  ctx: UserMutationCtx,
  { changeId }: { changeId: Id<"changes"> }
) {
  const change = await ctx.db.get(changeId);
  if (!change || change.userId !== ctx.userId) {
    throw new ConvexError(
      "Change not found. Call list_changes to see recent changes."
    );
  }
  if (change.undoneAt !== undefined) {
    throw new ConvexError("That change was already undone.");
  }
  const ownedFolders = new Map(
    (await listFolders(ctx)).map((folder) => [folder._id, folder])
  );
  const folderOrTop = (folderId: Id<"folders"> | undefined) =>
    folderId && ownedFolders.has(folderId) ? folderId : undefined;
  for (const step of change.undo.toReversed()) {
    // biome-ignore lint/performance/noAwaitInLoops: steps undo in reverse order, each seeing the one before
    await undoStepIn(ctx, step, folderOrTop, ownedFolders);
  }
  await ctx.db.patch(changeId, { undoneAt: Date.now() });
  return { undone: change.summary };
}

async function undoStepIn(
  ctx: UserMutationCtx,
  step: UndoStep,
  folderOrTop: (
    folderId: Id<"folders"> | undefined
  ) => Id<"folders"> | undefined,
  ownedFolders: Map<Id<"folders">, { parentId?: Id<"folders"> }>
) {
  switch (step.kind) {
    case "moveBookmark": {
      const bookmark = await ctx.db.get(step.bookmarkId);
      if (bookmark?.userId === ctx.userId) {
        await ctx.db.patch(step.bookmarkId, {
          folderId: folderOrTop(step.folderId),
        });
      }
      return;
    }
    case "moveFolder": {
      const folder = ownedFolders.get(step.folderId);
      if (!folder) {
        return;
      }
      const parentId = folderOrTop(step.parentId);
      const safeParent =
        parentId && isInside(ownedFolders, parentId, step.folderId)
          ? undefined
          : parentId;
      folder.parentId = safeParent;
      await ctx.db.patch(step.folderId, { parentId: safeParent });
      return;
    }
    case "restoreBookmark":
      await ctx.db.insert("bookmarks", {
        userId: ctx.userId,
        url: step.url,
        title: step.title,
        folderId: folderOrTop(step.folderId),
        savedAt: step.savedAt,
        faviconUrl: step.faviconUrl,
      });
      return;
    case "removeBookmark": {
      const bookmark = await ctx.db.get(step.bookmarkId);
      if (bookmark?.userId === ctx.userId) {
        await ctx.db.delete(step.bookmarkId);
      }
      return;
    }
    default:
      return step satisfies never;
  }
}

function isInside(
  folders: Map<Id<"folders">, { parentId?: Id<"folders"> }>,
  candidateId: Id<"folders">,
  folderId: Id<"folders">
) {
  let currentId: Id<"folders"> | undefined = candidateId;
  while (currentId) {
    if (currentId === folderId) {
      return true;
    }
    currentId = folders.get(currentId)?.parentId;
  }
  return false;
}
