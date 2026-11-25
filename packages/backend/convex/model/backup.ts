import type { Doc, Id } from "../_generated/dataModel";
import type { UserQueryCtx } from "../functions";
import { listBookmarks, savedAtOf } from "./bookmarks";
import { listFolders } from "./folders";
import { type FileNode, serializeBookmarkFile } from "./netscape";

export async function exportLibrary(ctx: UserQueryCtx) {
  const [folders, bookmarks] = await Promise.all([
    listFolders(ctx),
    listBookmarks(ctx),
  ]);
  return serializeBookmarkFile(libraryAsFileNodes(folders, bookmarks));
}

// Folders first (by name), then bookmarks newest first, the way the app
// shows them. Top-level bookmarks stay at the top of the file.
export function libraryAsFileNodes(
  folders: Doc<"folders">[],
  bookmarks: Doc<"bookmarks">[]
) {
  const foldersByParent = Map.groupBy(folders, (folder) => folder.parentId);
  const bookmarksByFolder = Map.groupBy(
    bookmarks,
    (bookmark) => bookmark.folderId
  );
  const childrenOf = (parentId: Id<"folders"> | undefined): FileNode[] => [
    ...(foldersByParent.get(parentId) ?? [])
      .toSorted((first, second) => first.name.localeCompare(second.name))
      .map(
        (folder): FileNode => ({
          kind: "folder",
          title: folder.name,
          addedAt: Math.floor(folder._creationTime),
          children: childrenOf(folder._id),
        })
      ),
    ...(bookmarksByFolder.get(parentId) ?? []).map(
      (bookmark): FileNode => ({
        kind: "bookmark",
        title: bookmark.title,
        url: bookmark.url,
        note: bookmark.note,
        tags: bookmark.tags,
        addedAt: savedAtOf(bookmark),
      })
    ),
  ];
  return childrenOf(undefined);
}
