import { describe, expect, test as it } from "bun:test";
import { createHistory } from "./history";

function counterEntry(state: { value: number }, label = "Add one") {
  return {
    label,
    undo: () => {
      state.value -= 1;
      return Promise.resolve();
    },
    redo: () => {
      state.value += 1;
      return Promise.resolve();
    },
  };
}

describe("createHistory", () => {
  it("undo steps back through recorded changes and redo steps forward", async () => {
    const history = createHistory();
    const state = { value: 2 };
    history.record(counterEntry(state, "first"));
    history.record(counterEntry(state, "second"));

    expect((await history.undo())?.label).toBe("second");
    expect((await history.undo())?.label).toBe("first");
    expect(await history.undo()).toBeUndefined();
    expect(state.value).toBe(0);

    expect((await history.redo())?.label).toBe("first");
    expect(state.value).toBe(1);
    expect(history.state()).toEqual({ canUndo: true, canRedo: true });
  });

  it("a new change clears what could be redone", async () => {
    const history = createHistory();
    const state = { value: 0 };
    history.record(counterEntry(state));
    await history.undo();

    history.record(counterEntry(state));

    expect(history.state().canRedo).toBe(false);
    expect(await history.redo()).toBeUndefined();
  });

  it("a failed undo keeps the change so it can be tried again", async () => {
    const history = createHistory();
    history.record({
      label: "flaky",
      undo: () => Promise.reject(new Error("offline")),
      redo: () => Promise.resolve(),
    });

    await expect(history.undo()).rejects.toThrow("offline");

    expect(history.state()).toEqual({ canUndo: true, canRedo: false });
  });

  it("ignores undo and redo while one is still running", async () => {
    const history = createHistory();
    const calls: string[] = [];
    let finish: () => void = () => undefined;
    history.record({
      label: "slow",
      undo: () =>
        new Promise<void>((resolve) => {
          calls.push("undo");
          finish = resolve;
        }),
      redo: () => {
        calls.push("redo");
        return Promise.resolve();
      },
    });

    const first = history.undo();
    const second = await history.undo();
    finish();
    await first;

    expect(second).toBeUndefined();
    expect(calls).toEqual(["undo"]);
  });

  it("keeps only the most recent changes", async () => {
    const history = createHistory(2);
    const state = { value: 3 };
    history.record(counterEntry(state, "first"));
    history.record(counterEntry(state, "second"));
    history.record(counterEntry(state, "third"));

    await history.undo();
    await history.undo();

    expect(await history.undo()).toBeUndefined();
    expect(state.value).toBe(1);
  });

  it("follows an item to the ID it got when it was re-created", () => {
    const history = createHistory();
    history.alias("deleted", "restored");
    history.alias("restored", "restored-again");

    expect(history.resolve<string>("deleted")).toBe("restored-again");
    expect(history.resolve("untouched")).toBe("untouched");
  });

  it("tells subscribers when undo or redo becomes possible", async () => {
    const history = createHistory();
    const seen: boolean[] = [];
    history.subscribe(() => seen.push(history.state().canUndo));

    history.record(counterEntry({ value: 0 }));
    await history.undo();

    expect(seen).toEqual([true, false]);
  });
});
