import { api } from "@schnellbuch/backend/api";
import type { Doc } from "@schnellbuch/backend/data-model";
import type { FolderNode } from "@schnellbuch/backend/tree";
import { createContext, useContext } from "react";
import type { LibrarySource } from "@/lib/mirror";
import { useOnlineMutation } from "@/lib/offline";

export interface Library {
  bookmarks: Doc<"bookmarks">[];
  flatFolders: FolderNode<Doc<"folders">>[];
  loaded: boolean;
  mirroredAt?: number;
  // "mirror": the copy saved on this device, shown while offline.
  source: LibrarySource;
  tree: FolderNode<Doc<"folders">>[];
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

export function useUpdateBookmark() {
  return useOnlineMutation(api.bookmarks.update).withOptimisticUpdate(
    (store, change) => {
      const bookmarks = store.getQuery(api.bookmarks.list, {});
      if (!bookmarks) {
        return;
      }
      store.setQuery(
        api.bookmarks.list,
        {},
        bookmarks.map((bookmark) => {
          if (bookmark._id !== change.bookmarkId) {
            return bookmark;
          }
          return {
            ...bookmark,
            ...(change.title === undefined ? {} : { title: change.title }),
            ...(change.url === undefined ? {} : { url: change.url }),
            ...(change.folderId === undefined
              ? {}
              : { folderId: change.folderId ?? undefined }),
          };
        })
      );
    }
  );
}

export function useRemoveBookmark() {
  return useOnlineMutation(api.bookmarks.remove).withOptimisticUpdate(
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

export function useUpdateFolder() {
  return useOnlineMutation(api.folders.update).withOptimisticUpdate(
    (store, change) => {
      const folders = store.getQuery(api.folders.list, {});
      if (!folders) {
        return;
      }
      store.setQuery(
        api.folders.list,
        {},
        folders.map((folder) => {
          if (folder._id !== change.folderId) {
            return folder;
          }
          return {
            ...folder,
            ...(change.name === undefined
              ? {}
              : { name: change.name.trim() || folder.name }),
            ...(change.parentId === undefined
              ? {}
              : { parentId: change.parentId ?? undefined }),
            ...(change.color === undefined
              ? {}
              : { color: change.color ?? undefined }),
            ...(change.mark === undefined
              ? {}
              : { mark: change.mark ?? undefined }),
          };
        })
      );
    }
  );
}
