// The /add save popup remembers the folder last saved to, per browser, so
// saving a run of related pages takes no clicks.
const KEY = "schnellbuch:last-folder";

interface KeyValueStore {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

function browserStore(): KeyValueStore | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    // Storage blocked (private window, site data off): nothing remembered.
  }
}

// undefined means the top level.
export function recallFolder(store = browserStore()) {
  try {
    return store?.getItem(KEY) || undefined;
  } catch {
    // Unreadable storage: save at the top level.
  }
}

export function rememberFolder(
  folderId: string | undefined,
  store = browserStore()
) {
  try {
    if (folderId) {
      store?.setItem(KEY, folderId);
    } else {
      store?.removeItem(KEY);
    }
  } catch {
    // Private windows can refuse storage; the popup still works.
  }
}
