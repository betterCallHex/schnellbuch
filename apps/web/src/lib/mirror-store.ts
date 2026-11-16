import { inStore, STORES } from "@/lib/device-db";

// IndexedDB storage for the offline mirror, one entry per user. Every call
// fails soft: without storage the app simply has nothing to show offline.
const LAST_USER_KEY = "schnellbuch:last-user";

export async function loadMirror(userId: string): Promise<unknown> {
  try {
    return await inStore(STORES.mirrors, "readonly", (store) =>
      store.get(userId)
    );
  } catch {
    // Storage blocked or empty: nothing to show offline.
  }
}

export async function saveMirror(userId: string, mirror: unknown) {
  try {
    await inStore(STORES.mirrors, "readwrite", (store) =>
      store.put(mirror, userId)
    );
  } catch {
    // Storage full or blocked: offline browsing just won't have this copy.
  }
}

export async function deleteMirror(userId: string) {
  try {
    await inStore(STORES.mirrors, "readwrite", (store) => store.delete(userId));
  } catch {
    // Nothing stored, or storage blocked.
  }
}

// Not a secret: which mirror to open when the app starts offline.
export function rememberLastUser(userId: string | undefined) {
  try {
    if (userId) {
      localStorage.setItem(LAST_USER_KEY, userId);
    } else {
      localStorage.removeItem(LAST_USER_KEY);
    }
  } catch {
    // Storage blocked.
  }
}

export function recallLastUser() {
  try {
    return localStorage.getItem(LAST_USER_KEY) ?? undefined;
  } catch {
    // Storage blocked: start offline with nothing.
  }
}
