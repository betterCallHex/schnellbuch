import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { savedAtOf } from "./bookmarks";
import { tagsOf } from "./tags";
import {
  buildFolderTree,
  type FolderNode,
  flattenFolderTree,
  folderAndDescendants,
} from "./tree";

export const bookmarkResult = v.object({
  id: v.string(),
  title: v.string(),
  url: v.string(),
  folderId: v.union(v.string(), v.null()),
  folderPath: v.union(v.string(), v.null()),
  note: v.union(v.string(), v.null()),
  tags: v.array(v.string()),
  savedAt: v.string(),
});

export const folderResult = v.object({
  id: v.string(),
  name: v.string(),
  path: v.string(),
  parentId: v.union(v.string(), v.null()),
  bookmarkCount: v.number(),
});

type BookmarkResult = Infer<typeof bookmarkResult>;
type FolderResult = Infer<typeof folderResult>;

// What agents see of folders and bookmarks, from the folders alone: paths
// need no bookmarks.
export function describeFolders(folders: Doc<"folders">[]) {
  const flatTree = flattenFolderTree(buildFolderTree(folders));
  const nodeById = new Map(flatTree.map((folder) => [folder._id, folder]));
  return {
    flatTree,
    folder: (folderId: Id<"folders">, bookmarkCount: number) => {
      const node = nodeById.get(folderId);
      return node && folderSummary(node, bookmarkCount);
    },
    path: (folderId: Id<"folders"> | undefined) =>
      folderId ? nodeById.get(folderId)?.path : undefined,
    bookmark: (bookmark: Doc<"bookmarks">): BookmarkResult => ({
      id: bookmark._id,
      title: bookmark.title,
      url: bookmark.url,
      folderId: bookmark.folderId ?? null,
      folderPath: bookmark.folderId
        ? (nodeById.get(bookmark.folderId)?.path ?? null)
        : null,
      note: bookmark.note ?? null,
      tags: tagsOf(bookmark),
      savedAt: new Date(savedAtOf(bookmark)).toISOString(),
    }),
  };
}

export function describeLibrary(
  folders: Doc<"folders">[],
  bookmarks: Doc<"bookmarks">[]
) {
  const described = describeFolders(folders);
  const countByFolder = Map.groupBy(bookmarks, (bookmark) => bookmark.folderId);
  const folderSummaries = described.flatTree.map((folder) =>
    folderSummary(folder, countByFolder.get(folder._id)?.length ?? 0)
  );
  return {
    folders: folderSummaries,
    // A folder's ID and every folder inside it.
    subtree: (folderId: Id<"folders">) =>
      folderAndDescendants(folders, folderId),
    bookmark: described.bookmark,
  };
}

function folderSummary(
  folder: FolderNode<Doc<"folders">>,
  bookmarkCount: number
): FolderResult {
  return {
    id: folder._id,
    name: folder.name,
    path: folder.path,
    parentId: folder.parentId ?? null,
    bookmarkCount,
  };
}
