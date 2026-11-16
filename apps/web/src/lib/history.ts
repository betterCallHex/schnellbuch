export interface HistoryEntry {
  label: string;
  redo: () => Promise<unknown>;
  undo: () => Promise<unknown>;
}

interface HistoryState {
  canRedo: boolean;
  canUndo: boolean;
}

const DEFAULT_LIMIT = 100;

export function createHistory(limit = DEFAULT_LIMIT) {
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];
  let running = false;
  let snapshot: HistoryState = { canUndo: false, canRedo: false };
  const aliases = new Map<string, string>();
  const listeners = new Set<() => void>();

  function changed() {
    snapshot = { canUndo: past.length > 0, canRedo: future.length > 0 };
    for (const listener of listeners) {
      listener();
    }
  }

  async function step(direction: "undo" | "redo") {
    const from = direction === "undo" ? past : future;
    const entry = from.at(-1);
    if (running || !entry) {
      return;
    }
    running = true;
    try {
      await entry[direction]();
    } finally {
      running = false;
    }
    if (direction === "undo") {
      past = past.slice(0, -1);
      future = [...future, entry];
    } else {
      future = future.slice(0, -1);
      past = [...past, entry];
    }
    changed();
    return entry;
  }

  return {
    record(entry: HistoryEntry) {
      past = [...past, entry].slice(-limit);
      future = [];
      changed();
    },
    undo: () => step("undo"),
    redo: () => step("redo"),
    alias(from: string, to: string) {
      aliases.set(from, to);
    },
    resolve<Id extends string>(id: Id): Id {
      let current: string = id;
      for (let next = aliases.get(current); next; next = aliases.get(current)) {
        current = next;
      }
      return current as Id;
    },
    state: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
