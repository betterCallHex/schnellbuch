import { api } from "@schnellbuch/backend/api";
import { buildFolderTree, flattenFolderTree } from "@schnellbuch/backend/tree";
import { useMutation, useQuery } from "convex/react";

export function useLibrary() {
  const folders = useQuery(api.folders.list, {});
  const bookmarks = useQuery(api.bookmarks.list, {});
  const tree = buildFolderTree(folders ?? []);
  return {
    loaded: folders !== undefined && bookmarks !== undefined,
    bookmarks: bookmarks ?? [],
    tree,
    flatFolders: flattenFolderTree(tree),
  };
}

export type Library = ReturnType<typeof useLibrary>;
export type FolderEntry = Library["flatFolders"][number];
export type BookmarkEntry = Library["bookmarks"][number];

export function useUpdateBookmark() {
  return useMutation(api.bookmarks.update).withOptimisticUpdate(
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

export function useUpdateFolder() {
  return useMutation(api.folders.update).withOptimisticUpdate(
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
          };
        })
      );
    }
  );
}
