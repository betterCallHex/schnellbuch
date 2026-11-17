interface FolderRecord<Id extends string> {
  _id: Id;
  name: string;
  parentId?: Id;
}

export type FolderNode<Folder> = Folder & {
  path: string;
  depth: number;
  children: FolderNode<Folder>[];
};

export function buildFolderTree<
  Id extends string,
  Folder extends FolderRecord<Id>,
>(folders: Folder[]) {
  const childrenByParent = Map.groupBy(folders, (folder) => folder.parentId);
  const toNode = (
    folder: Folder,
    parentPath: string,
    depth: number
  ): FolderNode<Folder> => {
    const path = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
    return {
      ...folder,
      path,
      depth,
      children: sortByName(childrenByParent.get(folder._id) ?? []).map(
        (child) => toNode(child, path, depth + 1)
      ),
    };
  };
  return sortByName(childrenByParent.get(undefined) ?? []).map((folder) =>
    toNode(folder, "", 0)
  );
}

export function flattenFolderTree<Folder>(
  nodes: FolderNode<Folder>[]
): FolderNode<Folder>[] {
  return nodes.flatMap((node) => [node, ...flattenFolderTree(node.children)]);
}

function sortByName<Folder extends { name: string }>(folders: Folder[]) {
  return folders.toSorted((first, second) =>
    first.name.localeCompare(second.name)
  );
}

interface Parented<Id extends string> {
  _id: Id;
  parentId?: Id;
}

// Looks up a folder's parent by ID.
export function parentLookup<Id extends string>(
  folders: Iterable<Parented<Id>>
) {
  const parentById = new Map<Id, Id | undefined>();
  for (const folder of folders) {
    parentById.set(folder._id, folder.parentId);
  }
  return (folderId: Id) => parentById.get(folderId);
}

// Whether candidateId is folderId itself or somewhere inside it.
export function isWithinFolder<Id extends string>(
  parentOf: (folderId: Id) => Id | undefined,
  candidateId: Id | undefined,
  folderId: Id
) {
  const seen = new Set<Id>();
  for (
    let currentId = candidateId;
    currentId && !seen.has(currentId);
    currentId = parentOf(currentId)
  ) {
    if (currentId === folderId) {
      return true;
    }
    seen.add(currentId);
  }
  return false;
}

// A folder's ID and the IDs of every folder inside it.
export function folderAndDescendants<Id extends string>(
  folders: Iterable<Parented<Id>>,
  rootId: Id
) {
  const childrenByParent = Map.groupBy(folders, (folder) => folder.parentId);
  const ids = new Set<Id>();
  const pending = [rootId];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (!ids.has(id)) {
      ids.add(id);
      pending.push(
        ...(childrenByParent.get(id) ?? []).map((child) => child._id)
      );
    }
  }
  return ids;
}
