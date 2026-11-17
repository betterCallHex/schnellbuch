import type { Id } from "@schnellbuch/backend/data-model";
import { type ConvexReactClient, useConvex, useConvexAuth } from "convex/react";
import type { FunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { inStore, inTransaction, STORES } from "@/lib/device-db";
import { errorMessage } from "@/lib/errors";
import { isOffline, useOffline } from "@/lib/offline";
import {
  applyEdits,
  checkEdits,
  copyFolderEdits,
  EDIT_MUTATIONS,
  type EditArgs,
  type EditKind,
  type EditResult,
  isCreate,
  type LibraryData,
  newTempId,
  type QueuedEdit,
  resolveIds,
} from "@/lib/offline-queue";

interface QueuedRecord {
  edit: QueuedEdit;
  seq: number;
  userId: string;
}

interface QueueState {
  base?: LibraryData;
  queue: QueuedRecord[];
  syncedIds: Readonly<Record<string, string>>;
  syncing: boolean;
  userId?: string;
}

interface SyncReport {
  failures: string[];
  saved: number;
}

type Send<Kind extends EditKind> = (
  args: EditArgs<Kind>
) => Promise<EditResult<Kind>>;

const CHANNEL = "schnellbuch:offline-queue";
const NO_EDITS: QueuedRecord[] = [];
const NEVER_SAVED = "It depends on a change that couldn't be saved.";
const NO_STORAGE = "This browser can't keep changes while you're offline.";

const queueStore = createStore<QueueState>(() => ({
  queue: NO_EDITS,
  syncedIds: {},
  syncing: false,
}));
let opened: { userId: string; ready: Promise<void> } | undefined;
let channel: BroadcastChannel | undefined;

export function useQueuedEdits(userId: string | undefined) {
  return useStore(queueStore, (state) =>
    userId !== undefined && state.userId === userId ? state.queue : NO_EDITS
  );
}

export function useSyncedId(id: string | undefined) {
  return useStore(queueStore, (state) =>
    id === undefined ? undefined : state.syncedIds[id]
  );
}

export function syncedId<ItemId extends string>(id: ItemId) {
  return (queueStore.getState().syncedIds[id] as ItemId | undefined) ?? id;
}

export function queuedEditCount() {
  return queueStore.getState().queue.length;
}

export function useQueueSync(
  userId: string | undefined,
  base: LibraryData | undefined
) {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const offline = useOffline();
  const waiting = useQueuedEdits(userId).length;

  useEffect(() => {
    if (userId) {
      openQueue(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (base) {
      queueStore.setState({ base });
    }
  }, [base]);

  useEffect(() => {
    if (userId && isAuthenticated && !offline && waiting > 0) {
      syncQueue(convex, userId);
    }
  }, [convex, userId, isAuthenticated, offline, waiting]);
}

export async function routeEdit<Kind extends EditKind>(
  userId: string | undefined,
  kind: Kind,
  args: EditArgs<Kind>,
  send: Send<Kind>
): Promise<EditResult<Kind>> {
  if (!(userId && (await shouldQueue(userId)))) {
    return send(knownIds(args));
  }
  const id = isCreate(kind) ? newTempId() : undefined;
  await queueEdits(userId, [{ kind, args, at: Date.now(), id } as QueuedEdit]);
  return id as EditResult<Kind>;
}

export async function routeFolderCopy(
  userId: string | undefined,
  args: { folderId: Id<"folders">; parentId?: Id<"folders"> },
  send: (args: {
    folderId: Id<"folders">;
    parentId?: Id<"folders">;
  }) => Promise<Id<"folders">>
) {
  if (!(userId && (await shouldQueue(userId)))) {
    return send(knownIds(args));
  }
  const { rootId, edits } = copyFolderEdits(
    currentView(userId),
    args,
    Date.now()
  );
  await queueEdits(userId, edits);
  return rootId;
}

export async function discardQueue(userId: string) {
  opened = undefined;
  queueStore.setState({ queue: NO_EDITS, syncedIds: {}, userId: undefined });
  await deleteStoredQueue(userId).catch(() => undefined);
}

async function deleteStoredQueue(userId: string) {
  const records = await readQueue(userId);
  await inTransaction(STORES.queue, "readwrite", (store) => {
    for (const record of records) {
      store.delete(record.seq);
    }
  });
  await inStore(STORES.syncedIds, "readwrite", (store) => store.clear());
}

function openQueue(userId: string) {
  if (opened?.userId !== userId) {
    opened = { userId, ready: reload(userId).then(forgetSyncedIds) };
    listenToOtherTabs();
  }
  return opened.ready;
}

// With nothing left to send, no stored edit refers to a temporary ID, so the
// stored map from temporary to real IDs can go. This tab keeps its copy in
// memory for its own undo history and URLs.
async function forgetSyncedIds() {
  if (queueStore.getState().queue.length > 0) {
    return;
  }
  await inStore(STORES.syncedIds, "readwrite", (store) => store.clear()).catch(
    () => undefined
  );
}

async function shouldQueue(userId: string) {
  await openQueue(userId);
  return isOffline() || queueStore.getState().queue.length > 0;
}

function knownIds<Args extends object>(args: Args) {
  const resolved = resolveIds(args, queueStore.getState().syncedIds);
  if (!resolved) {
    throw new ConvexError(NEVER_SAVED);
  }
  return resolved;
}

function currentView(userId: string) {
  const { base, queue } = queueStore.getState();
  return applyEdits(
    base ?? { folders: [], bookmarks: [] },
    queue.map((record) => record.edit),
    userId
  );
}

async function queueEdits(userId: string, edits: QueuedEdit[]) {
  if (queueStore.getState().base) {
    checkEdits(currentView(userId), edits, userId);
  }
  const stored = await inTransaction(STORES.queue, "readwrite", (store) => {
    for (const edit of edits) {
      store.add({ userId, edit });
    }
  }).then(
    () => true,
    () => false
  );
  if (!stored) {
    throw new ConvexError(NO_STORAGE);
  }
  await reload(userId);
  notifyOtherTabs();
}

async function reload(userId: string) {
  const [queue, stored] = await Promise.all([
    readQueue(userId).catch(() => NO_EDITS),
    readSyncedIds().catch(() => ({})),
  ]);
  queueStore.setState((state) => ({
    userId,
    queue,
    // IDs this tab already knows stay known, even once storage forgets them.
    syncedIds:
      state.userId === userId ? { ...state.syncedIds, ...stored } : stored,
  }));
}

async function readQueue(userId: string) {
  const records = await inStore<QueuedRecord[]>(
    STORES.queue,
    "readonly",
    (store) => store.getAll()
  );
  return records.filter((record) => record.userId === userId);
}

async function readSyncedIds() {
  const syncedIds: Record<string, string> = {};
  await inTransaction(STORES.syncedIds, "readonly", (store) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (current) {
        syncedIds[String(current.key)] = String(current.value);
        current.continue();
      }
    };
  });
  return syncedIds;
}

function listenToOtherTabs() {
  if (channel || typeof BroadcastChannel === "undefined") {
    return;
  }
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => {
    const { userId } = queueStore.getState();
    if (userId) {
      reload(userId);
    }
  };
}

function notifyOtherTabs() {
  channel?.postMessage("changed");
}

async function syncQueue(convex: ConvexReactClient, userId: string) {
  if (queueStore.getState().syncing) {
    return;
  }
  queueStore.setState({ syncing: true });
  let report: SyncReport | undefined;
  try {
    report = await oneTabAtATime(() => sendQueued(convex, userId));
  } finally {
    queueStore.setState({ syncing: false });
  }
  if (!report) {
    return;
  }
  announce(report);
  if (queueStore.getState().queue.length > 0 && !isOffline()) {
    await syncQueue(convex, userId);
  }
}

function oneTabAtATime<T>(work: () => Promise<T>) {
  if (!("locks" in navigator)) {
    return work();
  }
  return navigator.locks.request(
    CHANNEL,
    { ifAvailable: true },
    (lock): Promise<T> | undefined => (lock ? work() : undefined)
  );
}

async function sendQueued(
  convex: ConvexReactClient,
  userId: string,
  report: SyncReport = { saved: 0, failures: [] }
): Promise<SyncReport> {
  const next = await firstQueued(userId);
  if (!next) {
    return report;
  }
  await sendOne(convex, next.edit, report);
  await inStore(STORES.queue, "readwrite", (store) => store.delete(next.seq));
  await reload(userId);
  notifyOtherTabs();
  return sendQueued(convex, userId, report);
}

async function firstQueued(userId: string) {
  const queue = await readQueue(userId);
  return queue.at(0);
}

async function sendOne(
  convex: ConvexReactClient,
  edit: QueuedEdit,
  report: SyncReport
) {
  const args = resolveIds(edit.args, await readSyncedIds());
  if (!args) {
    report.failures.push(NEVER_SAVED);
    return;
  }
  try {
    const result: unknown = await convex.mutation(
      EDIT_MUTATIONS[edit.kind] as FunctionReference<"mutation">,
      args
    );
    if (edit.id && typeof result === "string") {
      await inStore(STORES.syncedIds, "readwrite", (store) =>
        store.put(result, edit.id)
      );
    }
    report.saved += 1;
  } catch (error) {
    report.failures.push(errorMessage(error));
  }
}

function announce({ saved, failures }: SyncReport) {
  if (failures.length > 0) {
    toast.error(`${changes(failures.length)} made offline couldn't be saved`, {
      description: [...new Set(failures)].join(" "),
    });
    return;
  }
  if (saved > 0) {
    toast.success(`Synced ${changes(saved)} made offline`);
  }
}

function changes(count: number) {
  return count === 1 ? "1 change" : `${count} changes`;
}
