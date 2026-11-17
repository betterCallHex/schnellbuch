import type { Id } from "@schnellbuch/backend/data-model";
import type {
  FolderColor,
  FolderMark,
} from "@schnellbuch/backend/folder-style";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useStore } from "zustand";
import { errorMessage } from "@/lib/errors";
import {
  createHistory,
  type HistoryEntry,
  nextRedo,
  nextUndo,
} from "@/lib/history";
import {
  type BookmarkEntry,
  type FolderEntry,
  type LibraryMutations,
  useLibrary,
  useLibraryMutations,
} from "@/lib/library";
import { syncedId } from "@/lib/offline-queue-store";
import { itemsLabel, type LibraryItem } from "@/lib/selection";
import { displayHost, findSaved } from "@/lib/views";

type FolderId = Id<"folders">;
type BookmarkId = Id<"bookmarks">;

interface FolderStyle {
  color: FolderColor | null;
  mark: FolderMark | null;
}

interface BookmarkFields {
  folderId: FolderId | null;
  note: string;
  title: string;
  url: string;
}

// One edit: how to make it and how to take it back.
interface Step {
  apply: () => Promise<unknown>;
  revert: () => Promise<unknown>;
}

export const EDIT_TOAST = "library-edit";

const tabHistory = createHistory();

export function undoLastEdit() {
  return stepHistory(tabHistory.undo, "Undone");
}

export function redoLastEdit() {
  return stepHistory(tabHistory.redo, "Redone");
}

export function useEditHistory() {
  return {
    undoLabel: useStore(tabHistory.store, (state) => nextUndo(state)?.label),
    redoLabel: useStore(tabHistory.store, (state) => nextRedo(state)?.label),
  };
}

export function liveId<ItemId extends string>(id: ItemId) {
  return live(id);
}

export function useLibraryEdits() {
  const mutations = useLibraryMutations();
  const { bookmarks, flatFolders } = useLibrary();
  const navigate = useNavigate();
  const steps = editSteps(mutations);
  const bookmarkIdsIn = (folderId: FolderId) =>
    bookmarks
      .filter((bookmark) => bookmark.folderId === folderId)
      .map((bookmark) => bookmark._id);

  function showExisting(bookmark: BookmarkEntry) {
    const path = bookmark.folderId
      ? flatFolders.find((folder) => folder._id === bookmark.folderId)?.path
      : undefined;
    toast(`Already saved in ${path ?? "Bookmarks"}`, {
      id: EDIT_TOAST,
      description: bookmark.title,
      action: {
        label: "Show",
        onClick: () =>
          navigate({
            to: "/",
            search: { folder: bookmark.folderId, select: bookmark._id },
          }),
      },
    });
  }

  return {
    // Saves a link unless it's already saved, in which case it says where.
    // True when the link is in the library afterwards.
    async addBookmark(fields: {
      url: string;
      title?: string;
      note?: string;
      folderId?: FolderId;
    }) {
      const existing = findSaved(bookmarks, fields.url);
      if (existing) {
        showExisting(existing);
        return true;
      }
      const saved = await perform(
        `Add “${fields.title || displayHost(fields.url)}”`,
        steps.addBookmark(fields)
      );
      if (saved) {
        toast.success("Bookmark saved", { id: EDIT_TOAST });
      }
      return saved;
    },
    editBookmark: (bookmark: BookmarkEntry, fields: BookmarkFields) =>
      perform(`Edit “${bookmark.title}”`, steps.editBookmark(bookmark, fields)),
    moveBookmark: (bookmark: BookmarkEntry, folderId: FolderId | null) =>
      performSteps(
        `Move “${bookmark.title}”`,
        [steps.moveBookmark(bookmark, folderId)].filter(isStep)
      ),
    async deleteBookmark(bookmark: BookmarkEntry) {
      const deleted = await perform(
        `Delete “${bookmark.title}”`,
        steps.deleteBookmark(bookmark)
      );
      if (deleted) {
        announceWithUndo("Bookmark deleted");
      }
      return deleted;
    },
    createFolder: (fields: { name: string; parentId?: FolderId }) =>
      perform(`New folder “${fields.name.trim()}”`, steps.createFolder(fields)),
    renameFolder(folder: FolderEntry, name: string) {
      if (name.trim() === folder.name) {
        return Promise.resolve(true);
      }
      return perform(
        `Rename “${folder.name}”`,
        steps.renameFolder(folder, name)
      );
    },
    styleFolder: (folder: FolderEntry, style: FolderStyle) =>
      perform(`Customize “${folder.name}”`, steps.styleFolder(folder, style)),
    moveFolder: (folder: FolderEntry, parentId: FolderId | null) =>
      performSteps(
        `Move “${folder.name}”`,
        [steps.moveFolder(folder, parentId)].filter(isStep)
      ),
    async deleteFolder(folder: FolderEntry) {
      const deleted = await perform(
        `Delete “${folder.name}”`,
        steps.deleteFolder(folder, bookmarkIdsIn(folder._id))
      );
      if (deleted) {
        announceWithUndo("Folder deleted");
      }
      return deleted;
    },
    // Moves, deletes and pastes of a whole selection are one undo step.
    moveItems(items: LibraryItem[], target: FolderId | null) {
      const moves = items
        .map((item) =>
          item.kind === "bookmark"
            ? steps.moveBookmark(item.bookmark, target)
            : steps.moveFolder(item.folder, target)
        )
        .filter(isStep);
      return performSteps(`Move ${labelOf(items)}`, moves);
    },
    async deleteItems(items: LibraryItem[]) {
      const deleted = await performSteps(
        `Delete ${labelOf(items)}`,
        items.map((item) =>
          item.kind === "bookmark"
            ? steps.deleteBookmark(item.bookmark)
            : steps.deleteFolder(item.folder, bookmarkIdsIn(item.folder._id))
        )
      );
      if (deleted) {
        announceWithUndo(
          items.length === 1 ? "Deleted" : `${items.length} items deleted`
        );
      }
      return deleted;
    },
    pasteCopies(items: LibraryItem[], target: FolderId | null) {
      return performSteps(
        `Paste ${labelOf(items)}`,
        items.map((item) =>
          item.kind === "bookmark"
            ? steps.pasteBookmarkCopy(item.bookmark, target)
            : steps.pasteFolderCopy(item.folder, target)
        )
      );
    },
  };
}

function labelOf(items: LibraryItem[]) {
  return itemsLabel(
    items.map((item) => ({
      name: item.kind === "folder" ? item.folder.name : item.bookmark.title,
    }))
  );
}

async function stepHistory(
  step: () => Promise<HistoryEntry | undefined>,
  verb: string
) {
  try {
    const entry = await step();
    if (entry) {
      toast(`${verb}: ${entry.label}`, { id: EDIT_TOAST });
    }
  } catch (error) {
    toast.error(errorMessage(error), { id: EDIT_TOAST });
  }
}

function live<ItemId extends string>(id: ItemId): ItemId {
  const current = syncedId(tabHistory.resolve(id));
  return current === id ? id : live(current);
}

function isStep(step: Step | undefined): step is Step {
  return step !== undefined;
}

function editSteps({
  addBookmark,
  createFolder,
  duplicateBookmark,
  duplicateFolder,
  removeBookmark,
  removeFolder,
  removeFolderWithContents,
  updateBookmark,
  updateFolder,
}: LibraryMutations) {
  const setBookmark = (bookmarkId: BookmarkId, fields: BookmarkFields) => () =>
    updateBookmark({
      bookmarkId: live(bookmarkId),
      url: fields.url,
      title: fields.title,
      note: fields.note,
      folderId: liveFolder(fields.folderId),
    });
  const moveBookmarkTo =
    (bookmarkId: BookmarkId, folderId: FolderId | null) => () =>
      updateBookmark({
        bookmarkId: live(bookmarkId),
        folderId: liveFolder(folderId),
      });
  const setFolder =
    (
      folderId: FolderId,
      fields: {
        name?: string;
        parentId?: FolderId | null;
      } & Partial<FolderStyle>
    ) =>
    () =>
      updateFolder({
        folderId: live(folderId),
        ...fields,
        ...(fields.parentId === undefined
          ? {}
          : { parentId: liveFolder(fields.parentId) }),
      });

  return {
    addBookmark(fields: {
      url: string;
      title?: string;
      note?: string;
      folderId?: FolderId;
    }): Step {
      const created = recreatable(() =>
        addBookmark({ ...fields, folderId: liveOptional(fields.folderId) })
      );
      return {
        apply: created.create,
        revert: () => removeBookmark({ bookmarkId: created.current() }),
      };
    },
    editBookmark(bookmark: BookmarkEntry, fields: BookmarkFields): Step {
      return {
        apply: setBookmark(bookmark._id, fields),
        revert: setBookmark(bookmark._id, {
          url: bookmark.url,
          title: bookmark.title,
          note: bookmark.note ?? "",
          folderId: bookmark.folderId ?? null,
        }),
      };
    },
    moveBookmark(
      bookmark: BookmarkEntry,
      folderId: FolderId | null
    ): Step | undefined {
      const from = bookmark.folderId ?? null;
      if (from === folderId) {
        return;
      }
      return {
        apply: moveBookmarkTo(bookmark._id, folderId),
        revert: moveBookmarkTo(bookmark._id, from),
      };
    },
    deleteBookmark(bookmark: BookmarkEntry): Step {
      const restored = recreatable(
        () =>
          addBookmark({
            url: bookmark.url,
            title: bookmark.title,
            note: bookmark.note,
            folderId: liveOptional(bookmark.folderId),
            savedAt: bookmark.savedAt ?? bookmark._creationTime,
          }),
        bookmark._id
      );
      return {
        apply: () => removeBookmark({ bookmarkId: live(bookmark._id) }),
        revert: restored.create,
      };
    },
    pasteBookmarkCopy(
      bookmark: BookmarkEntry,
      folderId: FolderId | null
    ): Step {
      const copy = recreatable(() =>
        duplicateBookmark({
          bookmarkId: live(bookmark._id),
          folderId: liveOptional(folderId ?? undefined),
        })
      );
      return {
        apply: copy.create,
        revert: () => removeBookmark({ bookmarkId: copy.current() }),
      };
    },
    createFolder(fields: { name: string; parentId?: FolderId }): Step {
      const created = recreatable(() =>
        createFolder({ ...fields, parentId: liveOptional(fields.parentId) })
      );
      return {
        apply: created.create,
        revert: () => removeFolder({ folderId: created.current() }),
      };
    },
    renameFolder(folder: FolderEntry, name: string): Step {
      return {
        apply: setFolder(folder._id, { name }),
        revert: setFolder(folder._id, { name: folder.name }),
      };
    },
    styleFolder(folder: FolderEntry, style: FolderStyle): Step {
      return {
        apply: setFolder(folder._id, style),
        revert: setFolder(folder._id, {
          color: folder.color ?? null,
          mark: folder.mark ?? null,
        }),
      };
    },
    moveFolder(
      folder: FolderEntry,
      parentId: FolderId | null
    ): Step | undefined {
      const from = folder.parentId ?? null;
      if (from === parentId || folder._id === parentId) {
        return;
      }
      return {
        apply: setFolder(folder._id, { parentId }),
        revert: setFolder(folder._id, { parentId: from }),
      };
    },
    deleteFolder(folder: FolderEntry, bookmarkIds: BookmarkId[]): Step {
      const restored = recreatable(
        () =>
          createFolder({
            name: folder.name,
            parentId: liveOptional(folder.parentId),
            color: folder.color,
            mark: folder.mark,
          }),
        folder._id
      );
      const childIds = folder.children.map((child) => child._id);
      return {
        apply: () => removeFolder({ folderId: live(folder._id) }),
        async revert() {
          const folderId = await restored.create();
          await Promise.allSettled([
            ...childIds.map((childId) =>
              updateFolder({ folderId: live(childId), parentId: folderId })
            ),
            ...bookmarkIds.map((bookmarkId) =>
              updateBookmark({ bookmarkId: live(bookmarkId), folderId })
            ),
          ]);
        },
      };
    },
    pasteFolderCopy(folder: FolderEntry, parentId: FolderId | null): Step {
      const copy = recreatable(() =>
        duplicateFolder({
          folderId: live(folder._id),
          parentId: liveOptional(parentId ?? undefined),
        })
      );
      return {
        apply: copy.create,
        revert: () => removeFolderWithContents({ folderId: copy.current() }),
      };
    },
  };
}

function perform(label: string, step: Step) {
  return performSteps(label, [step]);
}

// Runs the steps in order and records the ones that worked as one undo
// entry. True when every step worked (or there was nothing to do).
async function performSteps(label: string, steps: Step[]) {
  const done: Step[] = [];
  let failure: unknown;
  for (const step of steps) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: steps run in order, so a later one can rely on an earlier one
      await step.apply();
      done.push(step);
    } catch (error) {
      failure = error;
      break;
    }
  }
  if (failure !== undefined) {
    toast.error(errorMessage(failure), { id: EDIT_TOAST });
  }
  if (done.length > 0) {
    tabHistory.record({
      label,
      undo: () => runInOrder(done.toReversed().map((step) => step.revert)),
      redo: () => runInOrder(done.map((step) => step.apply)),
    });
  }
  return failure === undefined;
}

async function runInOrder(work: (() => Promise<unknown>)[]) {
  for (const next of work) {
    // biome-ignore lint/performance/noAwaitInLoops: undo and redo replay steps in order
    await next();
  }
}

function recreatable<ItemId extends string>(
  create: () => Promise<ItemId>,
  original?: ItemId
) {
  let first = original;
  return {
    async create() {
      const id = await create();
      if (first === undefined) {
        first = id;
      } else {
        tabHistory.alias(live(first), id);
      }
      return id;
    },
    current() {
      if (first === undefined) {
        throw new Error("Nothing was created yet.");
      }
      return live(first);
    },
  };
}

function announceWithUndo(message: string) {
  toast(message, {
    id: EDIT_TOAST,
    action: { label: "Undo", onClick: undoLastEdit },
  });
}

function liveFolder(folderId: FolderId | null) {
  return folderId === null ? null : live(folderId);
}

function liveOptional(folderId: FolderId | undefined) {
  return folderId === undefined ? undefined : live(folderId);
}
