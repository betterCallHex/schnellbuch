import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { BookmarkEntry, FolderEntry } from "@/lib/library";

export type LibraryItem =
  | { kind: "bookmark"; bookmark: BookmarkEntry }
  | { kind: "folder"; folder: FolderEntry };

const NOTHING: LibraryItem[] = [];
const selection = createStore<{ items: LibraryItem[] }>(() => ({
  items: NOTHING,
}));

// What's selected in the folder on screen, for the Edit menu and dragging.
export function showSelection(items: LibraryItem[]) {
  selection.setState({ items: items.length > 0 ? items : NOTHING });
}

export function selectedItems() {
  return selection.getState().items;
}

export function useSelectedItems() {
  return useStore(selection, (state) => state.items);
}

export function itemId(item: LibraryItem) {
  return item.kind === "folder" ? item.folder._id : item.bookmark._id;
}

export function itemName(item: LibraryItem) {
  return item.kind === "folder" ? item.folder.name : item.bookmark.title;
}

// “Docs” for one item, “3 items” for several.
export function itemsLabel(items: { name: string }[]) {
  const [first] = items;
  if (items.length === 1 && first) {
    return `“${first.name}”`;
  }
  return `${items.length} items`;
}
