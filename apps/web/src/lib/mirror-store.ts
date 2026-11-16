// IndexedDB storage for the offline mirror, one entry per user. Every call
// fails soft: without storage the app simply has nothing to show offline.
const DATABASE = "schnellbuch";
const STORE = "mirrors";
const LAST_USER_KEY = "schnellbuch:last-user";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(
        database.transaction(STORE, mode).objectStore(STORE)
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function loadMirror(userId: string): Promise<unknown> {
  try {
    return await run("readonly", (store) => store.get(userId));
  } catch {
    // Storage blocked or empty: nothing to show offline.
  }
}

export async function saveMirror(userId: string, mirror: unknown) {
  try {
    await run("readwrite", (store) => store.put(mirror, userId));
  } catch {
    // Storage full or blocked: offline browsing just won't have this copy.
  }
}

export async function deleteMirror(userId: string) {
  try {
    await run("readwrite", (store) => store.delete(userId));
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
