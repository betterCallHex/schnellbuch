import { describe, expect, test as it } from "bun:test";
import { nextGridIndex } from "./grid-navigation";

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
