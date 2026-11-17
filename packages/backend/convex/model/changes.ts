import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { UserMutationCtx, UserQueryCtx } from "../functions";
import type { undoStep } from "../schema";
import { savedAtOf } from "./bookmarks";
import { deleteFolder, listFolders } from "./folders";
import { isWithinFolder } from "./tree";

type UndoStep = Infer<typeof undoStep>;
type FolderId = Id<"folders">;

const MAX_CHANGES_LISTED = 50;

export async function recordChange(
  ctx: UserMutationCtx,
  summary: string,
  undo: UndoStep[]
) {
  return await ctx.db.insert("changes", { userId: ctx.userId, summary, undo });
}

// The step that brings a deleted bookmark back.
export function restoreBookmarkStep(bookmark: Doc<"bookmarks">): UndoStep {
  return {
    kind: "restoreBookmark",
    url: bookmark.url,
    title: bookmark.title,
    folderId: bookmark.folderId,
    savedAt: savedAtOf(bookmark),
    faviconUrl: bookmark.faviconUrl,
    note: bookmark.note,
    urlFromAgent: bookmark.urlFromAgent,
  };
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
// gracefully: a bookmark whose folder is gone goes back to the top level,
// and nothing moves inside itself.
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
  const undo = new Undo(ctx, await listFolders(ctx));
  for (const step of change.undo.toReversed()) {
    // biome-ignore lint/performance/noAwaitInLoops: steps undo in reverse order, each seeing the one before
    await undo.step(step);
  }
  await ctx.db.patch(changeId, { undoneAt: Date.now() });
  return { undone: change.summary };
}

// The user's folders as the undo goes along, so each step sees the ones
// before it.
class Undo {
  private readonly ctx: UserMutationCtx;
  private readonly parents: Map<FolderId, FolderId | undefined>;

  constructor(ctx: UserMutationCtx, folders: Doc<"folders">[]) {
    this.ctx = ctx;
    this.parents = new Map(
      folders.map((folder) => [folder._id, folder.parentId])
    );
  }

  async step(step: UndoStep) {
    switch (step.kind) {
      case "moveBookmark":
        await this.patchBookmark(step.bookmarkId, {
          folderId: this.folderOrTop(step.folderId),
        });
        return;
      case "editBookmark":
        await this.patchBookmark(step.bookmarkId, {
          url: step.url,
          title: step.title,
          note: step.note,
          folderId: this.folderOrTop(step.folderId),
          urlFromAgent: step.urlFromAgent,
        });
        return;
      case "restoreBookmark":
        await this.ctx.db.insert("bookmarks", {
          userId: this.ctx.userId,
          url: step.url,
          title: step.title,
          folderId: this.folderOrTop(step.folderId),
          savedAt: step.savedAt,
          faviconUrl: step.faviconUrl,
          note: step.note,
          urlFromAgent: step.urlFromAgent,
        });
        return;
      case "removeBookmark":
        if (await this.ownsBookmark(step.bookmarkId)) {
          await this.ctx.db.delete(step.bookmarkId);
        }
        return;
      case "moveFolder":
        await this.placeFolder(step.folderId, step.parentId);
        return;
      case "editFolder":
        if (this.parents.has(step.folderId)) {
          await this.ctx.db.patch(step.folderId, { name: step.name });
          await this.placeFolder(step.folderId, step.parentId);
        }
        return;
      case "removeFolder":
        await this.removeFolder(step.folderId);
        return;
      case "restoreFolder":
        await this.restoreFolder(step);
        return;
      default:
        return step satisfies never;
    }
  }

  private folderOrTop(folderId: FolderId | undefined) {
    return folderId && this.parents.has(folderId) ? folderId : undefined;
  }

  private async ownsBookmark(bookmarkId: Id<"bookmarks">) {
    const bookmark = await this.ctx.db.get(bookmarkId);
    return bookmark?.userId === this.ctx.userId;
  }

  private async patchBookmark(
    bookmarkId: Id<"bookmarks">,
    fields: Partial<Doc<"bookmarks">>
  ) {
    if (await this.ownsBookmark(bookmarkId)) {
      await this.ctx.db.patch(bookmarkId, fields);
    }
  }

  // Moves a folder under parentId, or to the top level when that parent is
  // gone or would put the folder inside itself.
  private async placeFolder(
    folderId: FolderId,
    parentId: FolderId | undefined
  ) {
    if (!this.parents.has(folderId)) {
      return;
    }
    const wanted = this.folderOrTop(parentId);
    const safeParent = isWithinFolder(
      (id) => this.parents.get(id),
      wanted,
      folderId
    )
      ? undefined
      : wanted;
    this.parents.set(folderId, safeParent);
    await this.ctx.db.patch(folderId, { parentId: safeParent });
  }

  private async removeFolder(folderId: FolderId) {
    if (!this.parents.has(folderId)) {
      return;
    }
    const parentId = this.parents.get(folderId);
    await deleteFolder(this.ctx, { folderId });
    this.parents.delete(folderId);
    for (const [childId, childParent] of this.parents) {
      if (childParent === folderId) {
        this.parents.set(childId, parentId);
      }
    }
  }

  private async restoreFolder(
    step: Extract<UndoStep, { kind: "restoreFolder" }>
  ) {
    const parentId = this.folderOrTop(step.parentId);
    const folderId = await this.ctx.db.insert("folders", {
      userId: this.ctx.userId,
      name: step.name,
      parentId,
      color: step.color,
      mark: step.mark,
    });
    this.parents.set(folderId, parentId);
    await Promise.all(
      step.bookmarkIds.map((bookmarkId) =>
        this.patchBookmark(bookmarkId, { folderId })
      )
    );
    for (const childId of step.folderIds) {
      // biome-ignore lint/performance/noAwaitInLoops: each move updates the folder map the next one checks
      await this.placeFolder(childId, folderId);
    }
  }
}
