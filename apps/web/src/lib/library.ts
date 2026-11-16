import { api } from "@schnellbuch/backend/api";
import type { Doc } from "@schnellbuch/backend/data-model";
import type { FolderNode } from "@schnellbuch/backend/tree";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { createContext, useContext } from "react";
import type { LibrarySource } from "@/lib/mirror";
import {
  type EditArgs,
  type EditKind,
  type EditResult,
  patchBookmark,
  patchFolder,
} from "@/lib/offline-queue";
import { routeEdit, routeFolderCopy } from "@/lib/offline-queue-store";

export interface Library {
  bookmarks: Doc<"bookmarks">[];
  flatFolders: FolderNode<Doc<"folders">>[];
  loaded: boolean;
  mirroredAt?: number;
  pendingIds: ReadonlySet<string>;
  // "mirror": the copy saved on this device, shown while offline.
  source: LibrarySource;
  tree: FolderNode<Doc<"folders">>[];
  userId?: string;
}

export const LibraryContext = createContext<Library | null>(null);

// The signed-in user's folders and bookmarks, from LibraryProvider.
export function useLibrary() {
  const library = useContext(LibraryContext);
  if (!library) {
    throw new Error("useLibrary needs a LibraryProvider above it.");
  }
  return library;
}

export type FolderEntry = Library["flatFolders"][number];
export type BookmarkEntry = Library["bookmarks"][number];

export function useLibraryMutations() {
  const { userId } = useLibrary();
  const duplicateFolder = useMutation(api.folders.duplicate);
  const route =
    <Kind extends EditKind>(
      kind: Kind,
      send: (args: EditArgs<Kind>) => Promise<EditResult<Kind>>
    ) =>
    (args: EditArgs<Kind>) =>
      routeEdit(userId, kind, args, send);
  return {
    addBookmark: route("addBookmark", useMutation(api.bookmarks.add)),
    duplicateBookmark: route(
      "duplicateBookmark",
      useMutation(api.bookmarks.duplicate)
    ),
    updateBookmark: route("updateBookmark", useUpdateBookmark()),
    removeBookmark: route("removeBookmark", useRemoveBookmark()),
    createFolder: route("createFolder", useMutation(api.folders.create)),
    updateFolder: route("updateFolder", useUpdateFolder()),
    removeFolder: route("removeFolder", useMutation(api.folders.remove)),
    removeFolderWithContents: route(
      "removeFolderWithContents",
      useMutation(api.folders.removeWithContents)
    ),
    duplicateFolder: (args: FunctionArgs<typeof api.folders.duplicate>) =>
      routeFolderCopy(userId, args, duplicateFolder),
  };
}

export type LibraryMutations = ReturnType<typeof useLibraryMutations>;

function useUpdateBookmark() {
  return useMutation(api.bookmarks.update).withOptimisticUpdate(
    (store, change) => {
      const bookmarks = store.getQuery(api.bookmarks.list, {});
      if (bookmarks) {
        store.setQuery(
          api.bookmarks.list,
          {},
          bookmarks.map((bookmark) =>
            bookmark._id === change.bookmarkId
              ? patchBookmark(bookmark, change)
              : bookmark
          )
        );
      }
    }
  );
}

function useRemoveBookmark() {
  return useMutation(api.bookmarks.remove).withOptimisticUpdate(
    (store, { bookmarkId }) => {
      const bookmarks = store.getQuery(api.bookmarks.list, {});
      if (bookmarks) {
        store.setQuery(
          api.bookmarks.list,
          {},
          bookmarks.filter((bookmark) => bookmark._id !== bookmarkId)
        );
      }
    }
  );
}

function useUpdateFolder() {
  return useMutation(api.folders.update).withOptimisticUpdate(
    (store, change) => {
      const folders = store.getQuery(api.folders.list, {});
      if (folders) {
        store.setQuery(
          api.folders.list,
          {},
          folders.map((folder) =>
            folder._id === change.folderId
              ? patchFolder(folder, change)
              : folder
          )
        );
      }
    }
  );
}
