import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { savedAtOf } from "./bookmarks";
import { buildFolderTree, flattenFolderTree } from "./tree";

export const bookmarkResult = v.object({
  id: v.string(),
  title: v.string(),
  url: v.string(),
  folderId: v.union(v.string(), v.null()),
  folderPath: v.union(v.string(), v.null()),
  savedAt: v.string(),
});

export const folderResult = v.object({
  id: v.string(),
  name: v.string(),
  path: v.string(),
  parentId: v.union(v.string(), v.null()),
  bookmarkCount: v.number(),
});

export function describeLibrary(
  folders: Doc<"folders">[],
  bookmarks: Doc<"bookmarks">[]
) {
  const flatTree = flattenFolderTree(buildFolderTree(folders));
  const pathById = new Map(flatTree.map((folder) => [folder._id, folder.path]));
  const countByFolder = Map.groupBy(bookmarks, (bookmark) => bookmark.folderId);
  const folderSummaries: Infer<typeof folderResult>[] = flatTree.map(
    (folder) => ({
      id: folder._id,
      name: folder.name,
      path: folder.path,
      parentId: folder.parentId ?? null,
      bookmarkCount: countByFolder.get(folder._id)?.length ?? 0,
    })
  );
  return {
    folders: folderSummaries,
    // A folder's ID and every folder inside it.
    subtree: (folderId: Id<"folders">) => {
      const node = flatTree.find((folder) => folder._id === folderId);
      return new Set(
        node ? flattenFolderTree([node]).map((folder) => folder._id) : []
      );
    },
    folder: (folderId: Id<"folders">) =>
      folderSummaries.find((folder) => folder.id === folderId),
    bookmark: (bookmark: Doc<"bookmarks">): Infer<typeof bookmarkResult> => ({
      id: bookmark._id,
      title: bookmark.title,
      url: bookmark.url,
      folderId: bookmark.folderId ?? null,
      folderPath: bookmark.folderId
        ? (pathById.get(bookmark.folderId) ?? null)
        : null,
      savedAt: new Date(savedAtOf(bookmark)).toISOString(),
    }),
  };
}
