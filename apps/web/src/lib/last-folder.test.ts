import { describe, expect, test as it } from "bun:test";
import { recallFolder, rememberFolder } from "./last-folder";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("last folder", () => {
  it("remembers the folder saved to last", () => {
    const store = memoryStore();
    rememberFolder("folder-1", store);
    expect(recallFolder(store)).toBe("folder-1");
  });

  it("choosing the top level forgets the folder", () => {
    const store = memoryStore();
    rememberFolder("folder-1", store);
    rememberFolder(undefined, store);
    expect(recallFolder(store)).toBeUndefined();
  });

  it("storage that throws is treated as empty", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => undefined,
    };
    expect(() => rememberFolder("x", broken)).not.toThrow();
    expect(recallFolder(broken)).toBeUndefined();
  });
});
