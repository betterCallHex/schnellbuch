const DATABASE = "schnellbuch";
const VERSION = 2;

export const STORES = {
  mirrors: "mirrors",
  queue: "offline-queue",
  syncedIds: "synced-ids",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

export async function inStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
) {
  let request: IDBRequest<T> | undefined;
  await inTransaction(storeName, mode, (store) => {
    request = work(store);
  });
  return request?.result as T;
}

export async function inTransaction(
  storeName: StoreName,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void
) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      work(transaction.objectStore(storeName));
    });
  } finally {
    database.close();
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => createStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createStores(database: IDBDatabase) {
  const existing = database.objectStoreNames;
  if (!existing.contains(STORES.mirrors)) {
    database.createObjectStore(STORES.mirrors);
  }
  if (!existing.contains(STORES.queue)) {
    database.createObjectStore(STORES.queue, {
      keyPath: "seq",
      autoIncrement: true,
    });
  }
  if (!existing.contains(STORES.syncedIds)) {
    database.createObjectStore(STORES.syncedIds);
  }
}
