import { describe, expect, test as it } from "bun:test";
import { importProgress, importSummary } from "./import-summary";

const none = { total: 0, imported: 0, duplicates: 0, nonWeb: 0, failed: 0 };

describe("importSummary", () => {
  it("says only what was imported when nothing was skipped", () => {
    expect(importSummary({ ...none, total: 1, imported: 1 })).toBe(
      "Imported 1 bookmark."
    );
  });

  it("lists what was skipped", () => {
    expect(
      importSummary({
        total: 10,
        imported: 6,
        duplicates: 3,
        nonWeb: 1,
        failed: 0,
      })
    ).toBe("Imported 6 bookmarks. Skipped 3 duplicates and 1 non-web link.");
  });
});

describe("importProgress", () => {
  it("counts skipped links as handled", () => {
    expect(
      importProgress({ ...none, total: 4, imported: 1, duplicates: 1 })
    ).toBe(0.5);
  });

  it("an empty import is complete", () => {
    expect(importProgress(none)).toBe(1);
  });
});
