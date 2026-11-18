import { describe, expect, test as it } from "bun:test";
import {
  boxBetween,
  combineSelection,
  edgeScrollSpeed,
  indexesInBox,
} from "./marquee";

const GRID = {
  rows: [
    { start: 0, end: 120 },
    { start: 120, end: 240 },
    { start: 240, end: 360 },
  ],
  columns: 3,
  width: 316,
  columnGap: 8,
  rowGap: 20,
  count: 8,
};

describe("boxBetween", () => {
  it("spans two points dragged in any direction", () => {
    expect(boxBetween({ x: 50, y: 10 }, { x: 5, y: 80 })).toEqual({
      left: 5,
      right: 50,
      top: 10,
      bottom: 80,
    });
  });
});

describe("indexesInBox", () => {
  it("selects every tile the box touches, row by row", () => {
    const box = boxBetween({ x: 90, y: 90 }, { x: 120, y: 130 });
    expect(indexesInBox({ ...GRID, box })).toEqual([0, 1, 3, 4]);
  });

  it("skips the gaps between columns and below each row", () => {
    const columnGap = boxBetween({ x: 101, y: 10 }, { x: 107, y: 300 });
    expect(indexesInBox({ ...GRID, box: columnGap })).toEqual([]);
    const rowGap = boxBetween({ x: 0, y: 101 }, { x: 316, y: 119 });
    expect(indexesInBox({ ...GRID, box: rowGap })).toEqual([]);
  });

  it("ignores the empty cells after the last tile", () => {
    const lastRow = boxBetween({ x: 0, y: 250 }, { x: 316, y: 260 });
    expect(indexesInBox({ ...GRID, box: lastRow })).toEqual([6, 7]);
  });

  it("covers a single-column list", () => {
    const box = boxBetween({ x: 300, y: 50 }, { x: 310, y: 200 });
    expect(
      indexesInBox({
        ...GRID,
        box,
        columns: 1,
        columnGap: 0,
        rowGap: 0,
        rows: [
          { start: 0, end: 44 },
          { start: 44, end: 88 },
          { start: 88, end: 132 },
          { start: 132, end: 176 },
          { start: 176, end: 220 },
        ],
      })
    ).toEqual([1, 2, 3, 4]);
  });
});

describe("combineSelection", () => {
  const keys = ["a", "b", "c", "d"];

  it("adds the box to the selection", () => {
    expect(
      combineSelection({
        keys,
        base: ["a", "c"],
        hits: ["c", "d"],
        toggle: false,
      })
    ).toEqual(["a", "c", "d"]);
  });

  it("flips the tiles under the box when toggling, like ⌘-drag in Finder", () => {
    expect(
      combineSelection({
        keys,
        base: ["a", "c"],
        hits: ["c", "d"],
        toggle: true,
      })
    ).toEqual(["a", "d"]);
  });
});

describe("edgeScrollSpeed", () => {
  it("stays still away from the edges", () => {
    expect(edgeScrollSpeed(400, 800)).toBe(0);
  });

  it("scrolls faster the deeper the pointer goes into an edge", () => {
    expect(edgeScrollSpeed(10, 800)).toBeLessThan(edgeScrollSpeed(30, 800));
    expect(edgeScrollSpeed(30, 800)).toBeLessThan(0);
    expect(edgeScrollSpeed(790, 800)).toBeGreaterThan(
      edgeScrollSpeed(770, 800)
    );
    expect(edgeScrollSpeed(770, 800)).toBeGreaterThan(0);
  });

  it("caps the speed once the pointer leaves the window", () => {
    expect(edgeScrollSpeed(2000, 800)).toBe(edgeScrollSpeed(800, 800));
    expect(edgeScrollSpeed(-500, 800)).toBe(edgeScrollSpeed(0, 800));
  });
});
