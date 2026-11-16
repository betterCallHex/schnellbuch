import type { Id } from "@schnellbuch/backend/data-model";
import type {
  FolderColor,
  FolderMark,
} from "@schnellbuch/backend/folder-style";
import { toast } from "sonner";
import { useStore } from "zustand";
import { errorMessage, succeeded } from "@/lib/errors";
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
  useLibraryMutations,
} from "@/lib/library";
import { syncedId } from "@/lib/offline-queue-store";
import { displayHost } from "@/lib/views";

type FolderId = Id<"folders">;
type BookmarkId = Id<"bookmarks">;

interface FolderStyle {
  color: FolderColor | null;
  mark: FolderMark | null;
}

interface BookmarkFields {
  folderId: FolderId | null;
  title: string;
  url: string;
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
  return {
    ...bookmarkEdits(mutations),
    ...folderEdits(mutations),
  };
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

function bookmarkEdits({
  addBookmark,
  duplicateBookmark,
  removeBookmark,
  updateBookmark,
}: LibraryMutations) {
  const setFields = (bookmarkId: BookmarkId, fields: BookmarkFields) => () =>
    updateBookmark({
      bookmarkId: live(bookmarkId),
      url: fields.url,
      title: fields.title,
      folderId: liveFolder(fields.folderId),
    });
  const moveTo = (bookmarkId: BookmarkId, folderId: FolderId | null) => () =>
    updateBookmark({
      bookmarkId: live(bookmarkId),
      folderId: liveFolder(folderId),
    });

  return {
    addBookmark(fields: { url: string; title?: string; folderId?: FolderId }) {
      const created = recreatable(() =>
        addBookmark({ ...fields, folderId: liveOptional(fields.folderId) })
      );
      return perform(
        `Add “${fields.title || displayHost(fields.url)}”`,
        created.create,
        () => removeBookmark({ bookmarkId: created.current() })
      );
    },
    editBookmark(bookmark: BookmarkEntry, fields: BookmarkFields) {
      return perform(
        `Edit “${bookmark.title}”`,
        setFields(bookmark._id, fields),
        setFields(bookmark._id, {
          url: bookmark.url,
          title: bookmark.title,
          folderId: bookmark.folderId ?? null,
        })
      );
    },
    moveBookmark(bookmark: BookmarkEntry, folderId: FolderId | null) {
      const from = bookmark.folderId ?? null;
      if (from === folderId) {
        return Promise.resolve(true);
      }
      return perform(
        `Move “${bookmark.title}”`,
        moveTo(bookmark._id, folderId),
        moveTo(bookmark._id, from)
      );
    },
    async deleteBookmark(bookmark: BookmarkEntry) {
      const restored = recreatable(
        () =>
          addBookmark({
            url: bookmark.url,
            title: bookmark.title,
            folderId: liveOptional(bookmark.folderId),
            savedAt: bookmark.savedAt ?? bookmark._creationTime,
          }),
        bookmark._id
      );
      const deleted = await perform(
        `Delete “${bookmark.title}”`,
        () => removeBookmark({ bookmarkId: live(bookmark._id) }),
        restored.create
      );
      if (deleted) {
        announceWithUndo("Bookmark deleted");
      }
      return deleted;
    },
    pasteBookmarkCopy(bookmark: BookmarkEntry, folderId: FolderId | null) {
      const copy = recreatable(() =>
        duplicateBookmark({
          bookmarkId: live(bookmark._id),
          folderId: liveOptional(folderId ?? undefined),
        })
      );
      return perform(`Paste “${bookmark.title}”`, copy.create, () =>
        removeBookmark({ bookmarkId: copy.current() })
      );
    },
  };
}

function folderEdits({
  createFolder,
  duplicateFolder,
  removeFolder,
  removeFolderWithContents,
  updateBookmark,
  updateFolder,
}: LibraryMutations) {
  const rename = (folderId: FolderId, name: string) => () =>
    updateFolder({ folderId: live(folderId), name });
  const restyle = (folderId: FolderId, style: FolderStyle) => () =>
    updateFolder({ folderId: live(folderId), ...style });
  const moveTo = (folderId: FolderId, parentId: FolderId | null) => () =>
    updateFolder({ folderId: live(folderId), parentId: liveFolder(parentId) });

  return {
    createFolder(fields: { name: string; parentId?: FolderId }) {
      const created = recreatable(() =>
        createFolder({ ...fields, parentId: liveOptional(fields.parentId) })
      );
      return perform(`New folder “${fields.name.trim()}”`, created.create, () =>
        removeFolder({ folderId: created.current() })
      );
    },
    renameFolder(folder: FolderEntry, name: string) {
      if (name.trim() === folder.name) {
        return Promise.resolve(true);
      }
      return perform(
        `Rename “${folder.name}”`,
        rename(folder._id, name),
        rename(folder._id, folder.name)
      );
    },
    styleFolder(folder: FolderEntry, style: FolderStyle) {
      return perform(
        `Customize “${folder.name}”`,
        restyle(folder._id, style),
        restyle(folder._id, {
          color: folder.color ?? null,
          mark: folder.mark ?? null,
        })
      );
    },
    moveFolder(folder: FolderEntry, parentId: FolderId | null) {
      const from = folder.parentId ?? null;
      if (from === parentId || folder._id === parentId) {
        return Promise.resolve(true);
      }
      return perform(
        `Move “${folder.name}”`,
        moveTo(folder._id, parentId),
        moveTo(folder._id, from)
      );
    },
    async deleteFolder(folder: FolderEntry, bookmarkIds: BookmarkId[]) {
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
      async function restore() {
        const folderId = await restored.create();
        await Promise.allSettled([
          ...childIds.map((childId) =>
            updateFolder({ folderId: live(childId), parentId: folderId })
          ),
          ...bookmarkIds.map((bookmarkId) =>
            updateBookmark({ bookmarkId: live(bookmarkId), folderId })
          ),
        ]);
      }
      const deleted = await perform(
        `Delete “${folder.name}”`,
        () => removeFolder({ folderId: live(folder._id) }),
        restore
      );
      if (deleted) {
        announceWithUndo("Folder deleted");
      }
      return deleted;
    },
    pasteFolderCopy(folder: FolderEntry, parentId: FolderId | null) {
      const copy = recreatable(() =>
        duplicateFolder({
          folderId: live(folder._id),
          parentId: liveOptional(parentId ?? undefined),
        })
      );
      return perform(`Paste “${folder.name}”`, copy.create, () =>
        removeFolderWithContents({ folderId: copy.current() })
      );
    },
  };
}

async function perform(
  label: string,
  apply: () => Promise<unknown>,
  revert: () => Promise<unknown>
) {
  if (!(await succeeded(apply()))) {
    return false;
  }
  tabHistory.record({ label, undo: revert, redo: apply });
  return true;
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
