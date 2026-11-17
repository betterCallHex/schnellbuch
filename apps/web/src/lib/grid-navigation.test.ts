import { describe, expect, test as it } from "bun:test";
import { gridColumns, nextGridIndex, selectRange } from "./grid-navigation";

describe("nextGridIndex", () => {
  it("left and right step through items, up and down jump a row", () => {
    expect(
      nextGridIndex({ current: 4, key: "ArrowRight", columns: 4, count: 10 })
    ).toBe(5);
    expect(
      nextGridIndex({ current: 4, key: "ArrowLeft", columns: 4, count: 10 })
    ).toBe(3);
    expect(
      nextGridIndex({ current: 4, key: "ArrowUp", columns: 4, count: 10 })
    ).toBe(0);
    expect(
      nextGridIndex({ current: 4, key: "ArrowDown", columns: 4, count: 10 })
    ).toBe(8);
  });

  it("stays inside the grid", () => {
    expect(
      nextGridIndex({ current: 1, key: "ArrowUp", columns: 4, count: 10 })
    ).toBe(0);
    expect(
      nextGridIndex({ current: 8, key: "ArrowDown", columns: 4, count: 10 })
    ).toBe(9);
  });

  it("the first arrow press selects the first item", () => {
    expect(
      nextGridIndex({
        current: undefined,
        key: "ArrowDown",
        columns: 4,
        count: 10,
      })
    ).toBe(0);
    expect(
      nextGridIndex({
        current: undefined,
        key: "ArrowDown",
        columns: 4,
        count: 0,
      })
    ).toBeUndefined();
  });
});

describe("gridColumns", () => {
  it("fits as many minimum-width tiles as the width allows, at least one", () => {
    expect(gridColumns(500, 112, 8)).toBe(4);
    expect(gridColumns(471, 112, 8)).toBe(3);
    expect(gridColumns(50, 112, 8)).toBe(1);
  });
});

describe("selectRange", () => {
  const keys = ["a", "b", "c", "d"];

  it("covers anchor to key in either direction", () => {
    expect(selectRange(keys, "b", "d")).toEqual(["b", "c", "d"]);
    expect(selectRange(keys, "c", "a")).toEqual(["a", "b", "c"]);
  });

  it("falls back to the clicked key when the anchor is gone", () => {
    expect(selectRange(keys, "z", "c")).toEqual(["c"]);
  });
});
