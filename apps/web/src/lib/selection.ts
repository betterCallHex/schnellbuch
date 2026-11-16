import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { BookmarkEntry, FolderEntry } from "@/lib/library";

export type LibraryItem =
  | { kind: "bookmark"; bookmark: BookmarkEntry }
  | { kind: "folder"; folder: FolderEntry };

const selection = createStore<{ item?: LibraryItem }>(() => ({}));

export function showSelection(item: LibraryItem | undefined) {
  selection.setState({ item });
}

export function useSelectedItem() {
  return useStore(selection, (state) => state.item);
}
