import { describe, expect, test as it } from "bun:test";
import { exportFileName } from "./backup";

describe("exportFileName", () => {
  it("is dated with the local day, zero-padded", () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 59))).toBe(
      "schnellbuch-2026-01-05.html"
    );
  });
});
