import type { Id } from "@schnellbuch/backend/data-model";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export type ClipboardItem =
  | { kind: "bookmark"; id: Id<"bookmarks">; name: string }
  | { kind: "folder"; id: Id<"folders">; name: string };

export interface Clip {
  items: ClipboardItem[];
  mode: "copy" | "cut";
  // What went on the system clipboard: links and folder names, a line each.
  text: string;
}

const clipboard = createStore<{ clip?: Clip }>(() => ({}));

export function hold(clip: Clip | undefined) {
  clipboard.setState({ clip });
}

export function heldClip() {
  return clipboard.getState().clip;
}

export function useHeldClip() {
  return useStore(clipboard, (state) => state.clip);
}

export function claimsPaste(clip: Clip | undefined, pastedText: string) {
  return clip !== undefined && clip.text === pastedText;
}
