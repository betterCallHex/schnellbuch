import { api } from "@schnellbuch/backend/api";
import type { Doc, Id } from "@schnellbuch/backend/data-model";
import { cleanTags, storedTags } from "@schnellbuch/backend/tags";
import {
  folderAndDescendants,
  isWithinFolder,
  parentLookup,
} from "@schnellbuch/backend/tree";
import { normalizeUrl, placeholderTitle } from "@schnellbuch/backend/url";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";

type FolderId = Id<"folders">;
type BookmarkId = Id<"bookmarks">;
type Folder = Doc<"folders">;
type Bookmark = Doc<"bookmarks">;

export interface LibraryData {
  bookmarks: Bookmark[];
  folders: Folder[];
}

export const EDIT_MUTATIONS = {
  addBookmark: api.bookmarks.add,
  duplicateBookmark: api.bookmarks.duplicate,
  updateBookmark: api.bookmarks.update,
  removeBookmark: api.bookmarks.remove,
  createFolder: api.folders.create,
  updateFolder: api.folders.update,
  removeFolder: api.folders.remove,
  removeFolderWithContents: api.folders.removeWithContents,
} as const;

export type EditKind = keyof typeof EDIT_MUTATIONS;
export type EditArgs<Kind extends EditKind> = FunctionArgs<
  (typeof EDIT_MUTATIONS)[Kind]
>;
export type EditResult<Kind extends EditKind> = FunctionReturnType<
  (typeof EDIT_MUTATIONS)[Kind]
>;

type CreateKind = "addBookmark" | "duplicateBookmark" | "createFolder";

export type QueuedEdit = {
  [Kind in EditKind]: {
    kind: Kind;
    args: EditArgs<Kind>;
    at: number;
  } & (Kind extends CreateKind ? { id: EditResult<Kind> } : { id?: never });
}[EditKind];

type EditOf<Kind extends EditKind> = Extract<QueuedEdit, { kind: Kind }>;

const FOLDER_NOT_FOUND = "Folder not found.";
const BOOKMARK_NOT_FOUND = "Bookmark not found.";
const FOLDER_INSIDE_ITSELF = "A folder can't move inside itself.";
const EMPTY_FOLDER_NAME = "Folder name can't be empty.";
const TEMP_PREFIX = "offline-";
const ID_FIELDS = ["bookmarkId", "folderId", "parentId"] as const;

export function isCreate(kind: EditKind): kind is CreateKind {
  return (
    kind === "addBookmark" ||
    kind === "duplicateBookmark" ||
    kind === "createFolder"
  );
}

export function newTempId<ItemId extends string>() {
  return `${TEMP_PREFIX}${crypto.randomUUID()}` as ItemId;
}

export function isTempId(id: string) {
  return id.startsWith(TEMP_PREFIX);
}

export function resolveIds<Args extends object>(
  args: Args,
  syncedIds: Readonly<Record<string, string>>
): Args | undefined {
  const resolved = { ...args } as Record<string, unknown>;
  for (const field of ID_FIELDS) {
    const id = resolved[field];
    if (typeof id === "string" && isTempId(id)) {
      const realId = syncedIds[id];
      if (!realId) {
        return;
      }
      resolved[field] = realId;
    }
  }
  return resolved as Args;
}

export function applyEdits(
  library: LibraryData,
  edits: readonly QueuedEdit[],
  userId: string
) {
  let current = library;
  const pendingIds = new Set<string>();
  for (const edit of edits) {
    if (problemWith(current, edit) === undefined) {
      current = applyEdit(current, edit, userId);
      const touched = touchedId(edit);
      if (touched) {
        pendingIds.add(touched);
      }
    }
  }
  return { ...current, pendingIds };
}

export function checkEdits(
  library: LibraryData,
  edits: readonly QueuedEdit[],
  userId: string
) {
  let current = library;
  for (const edit of edits) {
    const problem = problemWith(current, edit);
    if (problem) {
      throw new ConvexError(problem);
    }
    current = applyEdit(current, edit, userId);
  }
}

export function copyFolderEdits(
  library: LibraryData,
  { folderId, parentId }: { folderId: FolderId; parentId?: FolderId },
  at: number
) {
  const original = library.folders.find((folder) => folder._id === folderId);
  if (!original) {
    throw new ConvexError(FOLDER_NOT_FOUND);
  }
  const problem =
    parentId &&
    (folderProblem(library, parentId) ??
      cycleProblem(library, parentId, folderId));
  if (problem) {
    throw new ConvexError(problem);
  }
  const edits: QueuedEdit[] = [];
  const rootId = copyInto(
    library,
    original,
    { parentId, name: copyName(original, parentId) },
    { at, edits }
  );
  return { rootId, edits };
}

export function patchBookmark(
  bookmark: Bookmark,
  change: EditArgs<"updateBookmark">
): Bookmark {
  return {
    ...bookmark,
    ...(change.title === undefined ? {} : { title: change.title.trim() }),
    ...(change.note === undefined
      ? {}
      : { note: change.note.trim() || undefined }),
    ...(change.tags === undefined ? {} : { tags: storedTags(change.tags) }),
    ...(change.url === undefined ? {} : { url: normalizeUrl(change.url) }),
    ...(change.folderId === undefined
      ? {}
      : { folderId: change.folderId ?? undefined }),
  };
}

export function patchFolder(
  folder: Folder,
  change: EditArgs<"updateFolder">
): Folder {
  return {
    ...folder,
    ...(change.name === undefined
      ? {}
      : { name: change.name.trim() || folder.name }),
    ...(change.parentId === undefined
      ? {}
      : { parentId: change.parentId ?? undefined }),
    ...(change.color === undefined ? {} : { color: change.color ?? undefined }),
    ...(change.mark === undefined ? {} : { mark: change.mark ?? undefined }),
  };
}

function problemWith(library: LibraryData, edit: QueuedEdit) {
  switch (edit.kind) {
    case "addBookmark":
      return (
        urlProblem(edit.args.url) ??
        tagsProblem(edit.args.tags) ??
        folderProblem(library, edit.args.folderId)
      );
    case "duplicateBookmark":
      return (
        bookmarkProblem(library, edit.args.bookmarkId) ??
        folderProblem(library, edit.args.folderId)
      );
    case "updateBookmark":
      return bookmarkUpdateProblem(library, edit.args);
    case "removeBookmark":
      return bookmarkProblem(library, edit.args.bookmarkId);
    case "createFolder":
      return (
        nameProblem(edit.args.name) ??
        folderProblem(library, edit.args.parentId)
      );
    case "updateFolder":
      return folderUpdateProblem(library, edit.args);
    case "removeFolder":
    case "removeFolderWithContents":
      return folderProblem(library, edit.args.folderId);
    default:
      return edit satisfies never;
  }
}

function bookmarkUpdateProblem(
  library: LibraryData,
  change: EditArgs<"updateBookmark">
) {
  return (
    bookmarkProblem(library, change.bookmarkId) ??
    (change.url === undefined ? undefined : urlProblem(change.url)) ??
    tagsProblem(change.tags) ??
    folderProblem(library, change.folderId ?? undefined)
  );
}

function folderUpdateProblem(
  library: LibraryData,
  change: EditArgs<"updateFolder">
) {
  return (
    folderProblem(library, change.folderId) ??
    (change.name === undefined ? undefined : nameProblem(change.name)) ??
    (change.parentId
      ? (folderProblem(library, change.parentId) ??
        cycleProblem(library, change.parentId, change.folderId))
      : undefined)
  );
}

function bookmarkProblem(library: LibraryData, bookmarkId: BookmarkId) {
  return library.bookmarks.some((bookmark) => bookmark._id === bookmarkId)
    ? undefined
    : BOOKMARK_NOT_FOUND;
}

function folderProblem(library: LibraryData, folderId: FolderId | undefined) {
  return folderId === undefined ||
    library.folders.some((folder) => folder._id === folderId)
    ? undefined
    : FOLDER_NOT_FOUND;
}

function cycleProblem(
  library: LibraryData,
  candidateId: FolderId,
  folderId: FolderId
) {
  return isWithinFolder(parentLookup(library.folders), candidateId, folderId)
    ? FOLDER_INSIDE_ITSELF
    : undefined;
}

function urlProblem(url: string): string | undefined {
  try {
    normalizeUrl(url);
  } catch (error) {
    return error instanceof ConvexError
      ? String(error.data)
      : `"${url}" is not a web link.`;
  }
}

function tagsProblem(tags: string[] | undefined): string | undefined {
  try {
    cleanTags(tags ?? []);
  } catch (error) {
    return error instanceof ConvexError
      ? String(error.data)
      : "Those tags aren't valid.";
  }
}

function nameProblem(name: string) {
  return name.trim() ? undefined : EMPTY_FOLDER_NAME;
}

function applyEdit(
  library: LibraryData,
  edit: QueuedEdit,
  userId: string
): LibraryData {
  switch (edit.kind) {
    case "addBookmark":
      return withBookmark(library, addedBookmark(edit, userId));
    case "duplicateBookmark":
      return withDuplicate(library, edit);
    case "updateBookmark":
      return {
        ...library,
        bookmarks: library.bookmarks.map((bookmark) =>
          bookmark._id === edit.args.bookmarkId
            ? patchBookmark(bookmark, edit.args)
            : bookmark
        ),
      };
    case "removeBookmark":
      return {
        ...library,
        bookmarks: library.bookmarks.filter(
          (bookmark) => bookmark._id !== edit.args.bookmarkId
        ),
      };
    case "createFolder":
      return {
        ...library,
        folders: [...library.folders, createdFolder(edit, userId)],
      };
    case "updateFolder":
      return {
        ...library,
        folders: library.folders.map((folder) =>
          folder._id === edit.args.folderId
            ? patchFolder(folder, edit.args)
            : folder
        ),
      };
    case "removeFolder":
      return withoutFolder(library, edit.args.folderId);
    case "removeFolderWithContents":
      return withoutSubtree(library, edit.args.folderId);
    default:
      return edit satisfies never;
  }
}

function touchedId(edit: QueuedEdit) {
  if (edit.id) {
    return edit.id;
  }
  if (edit.kind === "updateBookmark") {
    return edit.args.bookmarkId;
  }
  if (edit.kind === "updateFolder") {
    return edit.args.folderId;
  }
}

function withBookmark(library: LibraryData, bookmark: Bookmark) {
  return { ...library, bookmarks: [bookmark, ...library.bookmarks] };
}

function addedBookmark(edit: EditOf<"addBookmark">, userId: string): Bookmark {
  const url = normalizeUrl(edit.args.url);
  return {
    _id: edit.id,
    _creationTime: edit.at,
    userId,
    url,
    title: edit.args.title?.trim() || placeholderTitle(url),
    note: edit.args.note?.trim() || undefined,
    tags: storedTags(edit.args.tags ?? []),
    folderId: edit.args.folderId,
    savedAt: edit.args.savedAt ?? edit.at,
  };
}

function withDuplicate(
  library: LibraryData,
  edit: EditOf<"duplicateBookmark">
) {
  const source = library.bookmarks.find(
    (bookmark) => bookmark._id === edit.args.bookmarkId
  );
  if (!source) {
    return library;
  }
  return withBookmark(library, {
    ...source,
    _id: edit.id,
    _creationTime: edit.at,
    folderId: edit.args.folderId,
  });
}

function createdFolder(edit: EditOf<"createFolder">, userId: string): Folder {
  return {
    _id: edit.id,
    _creationTime: edit.at,
    userId,
    name: edit.args.name.trim(),
    parentId: edit.args.parentId,
    color: edit.args.color,
    mark: edit.args.mark,
  };
}

function withoutFolder(library: LibraryData, folderId: FolderId) {
  const removed = library.folders.find((folder) => folder._id === folderId);
  const parentId = removed?.parentId;
  return {
    folders: library.folders
      .filter((folder) => folder._id !== folderId)
      .map((folder) =>
        folder.parentId === folderId ? { ...folder, parentId } : folder
      ),
    bookmarks: library.bookmarks.map((bookmark) =>
      bookmark.folderId === folderId
        ? { ...bookmark, folderId: parentId }
        : bookmark
    ),
  };
}

function withoutSubtree(library: LibraryData, folderId: FolderId) {
  const removed = folderAndDescendants(library.folders, folderId);
  return {
    folders: library.folders.filter((folder) => !removed.has(folder._id)),
    bookmarks: library.bookmarks.filter(
      (bookmark) => !(bookmark.folderId && removed.has(bookmark.folderId))
    ),
  };
}

function copyName(original: Folder, parentId: FolderId | undefined) {
  return original.parentId === parentId
    ? `${original.name} copy`
    : original.name;
}

function copyInto(
  library: LibraryData,
  folder: Folder,
  placement: { parentId: FolderId | undefined; name: string },
  output: { at: number; edits: QueuedEdit[] }
): FolderId {
  const id = newTempId<FolderId>();
  output.edits.push({
    kind: "createFolder",
    id,
    at: output.at,
    args: {
      name: placement.name,
      parentId: placement.parentId,
      color: folder.color,
      mark: folder.mark,
    },
  });
  for (const bookmark of library.bookmarks) {
    if (bookmark.folderId === folder._id) {
      output.edits.push({
        kind: "duplicateBookmark",
        id: newTempId<BookmarkId>(),
        at: output.at,
        args: { bookmarkId: bookmark._id, folderId: id },
      });
    }
  }
  for (const child of library.folders) {
    if (child.parentId === folder._id) {
      copyInto(library, child, { parentId: id, name: child.name }, output);
    }
  }
  return id;
}
