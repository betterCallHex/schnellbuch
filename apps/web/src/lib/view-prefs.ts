import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { SortOrder } from "@/lib/views";

export type Layout = "grid" | "list";

interface ViewPrefs {
  layout: Layout;
  sort: SortOrder;
}

// How folders are shown, remembered on this device.
const STORAGE_KEY = "schnellbuch:view";
const DEFAULTS: ViewPrefs = { layout: "grid", sort: "saved" };

const prefs = createStore<ViewPrefs>(() => DEFAULTS);
let loaded = false;

export function useViewPrefs() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    prefs.setState(readStored());
  }
  return useStore(prefs);
}

export function setViewPrefs(change: Partial<ViewPrefs>) {
  prefs.setState(change);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs.getState()));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

export function parseViewPrefs(value: string | null): ViewPrefs {
  try {
    const stored = JSON.parse(value ?? "{}") as Partial<ViewPrefs>;
    return {
      layout: stored.layout === "list" ? "list" : "grid",
      sort: stored.sort === "name" ? "name" : "saved",
    };
  } catch {
    return DEFAULTS;
  }
}

function readStored() {
  try {
    return parseViewPrefs(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULTS;
  }
}
