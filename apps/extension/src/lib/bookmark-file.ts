import {
  type FileNode,
  serializeBookmarkFile,
} from "@schnellbuch/backend/netscape";

interface TreeNode {
  children?: TreeNode[];
  dateAdded?: number;
  title: string;
  type?: string;
  url?: string;
}

export function bookmarkFile(tree: TreeNode[]) {
  const topFolders = tree
    .flatMap((root) => root.children ?? [])
    .flatMap(fileNodes)
    .filter((node) => node.kind === "bookmark" || node.children.length > 0);
  return serializeBookmarkFile(topFolders);
}

function fileNodes(node: TreeNode): FileNode[] {
  if (node.type === "separator") {
    return [];
  }
  if (node.url !== undefined) {
    return [
      {
        kind: "bookmark",
        title: node.title,
        url: node.url,
        addedAt: node.dateAdded,
      },
    ];
  }
  return [
    {
      kind: "folder",
      title: node.title,
      addedAt: node.dateAdded,
      children: (node.children ?? []).flatMap(fileNodes),
    },
  ];
}
