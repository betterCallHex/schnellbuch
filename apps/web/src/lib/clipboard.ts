import type { Id } from "@schnellbuch/backend/data-model";
import { useSyncExternalStore } from "react";

export type ClipboardItem =
  | { kind: "bookmark"; id: Id<"bookmarks">; name: string }
  | { kind: "folder"; id: Id<"folders">; name: string };

export interface Clip {
  item: ClipboardItem;
  mode: "copy" | "cut";
  text: string;
}

let held: Clip | undefined;
const listeners = new Set<() => void>();

export function hold(next: Clip | undefined) {
  held = next;
  for (const listener of listeners) {
    listener();
  }
}

export function heldClip() {
  return held;
}

export function useHeldClip() {
  return useSyncExternalStore(
    subscribe,
    () => held,
    () => undefined
  );
}

export function claimsPaste(clip: Clip | undefined, pastedText: string) {
  return clip !== undefined && clip.text === pastedText;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
