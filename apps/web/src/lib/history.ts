import { createStore } from "zustand/vanilla";

export interface HistoryEntry {
  label: string;
  redo: () => Promise<unknown>;
  undo: () => Promise<unknown>;
}

interface HistoryState {
  future: HistoryEntry[];
  past: HistoryEntry[];
}

const DEFAULT_LIMIT = 100;

export function nextUndo(state: HistoryState) {
  return state.past.at(-1);
}

export function nextRedo(state: HistoryState) {
  return state.future.at(-1);
}

export function createHistory(limit = DEFAULT_LIMIT) {
  const store = createStore<HistoryState>(() => ({ past: [], future: [] }));
  const aliases = new Map<string, string>();
  let running = false;

  async function step(direction: "undo" | "redo") {
    const state = store.getState();
    const entry = direction === "undo" ? nextUndo(state) : nextRedo(state);
    if (running || !entry) {
      return;
    }
    running = true;
    try {
      await entry[direction]();
    } finally {
      running = false;
    }
    store.setState(({ past, future }) => {
      const without = (entries: HistoryEntry[]) =>
        entries.filter((candidate) => candidate !== entry);
      return direction === "undo"
        ? { past: without(past), future: [...future, entry] }
        : { past: [...past, entry], future: without(future) };
    });
    return entry;
  }

  return {
    store,
    record(entry: HistoryEntry) {
      store.setState(({ past }) => ({
        past: [...past, entry].slice(-limit),
        future: [],
      }));
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
  };
}
