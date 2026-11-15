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
