import { afterEach, describe, expect, test as it, vi } from "vitest";
import { createTest } from "../testing/convex";
import { internal } from "./_generated/api";
import { KEEP_HISTORY_MS } from "./housekeeping";

const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe("pruneHistory", () => {
  it("deletes changes and imports older than 90 days and keeps newer ones", async () => {
    vi.useFakeTimers();
    const t = createTest();
    const folderId = await t.run((ctx) =>
      ctx.db.insert("folders", { userId: "owner", name: "Imported" })
    );
    const record = (summary: string) =>
      t.run(async (ctx) => {
        await ctx.db.insert("changes", { userId: "owner", summary, undo: [] });
        await ctx.db.insert("imports", {
          userId: "owner",
          fileName: `${summary}.html`,
          source: "Chrome",
          status: "done",
          folderId,
          total: 0,
          imported: 0,
          duplicates: 0,
          nonWeb: 0,
          failed: 0,
        });
      });
    await record("old");
    vi.advanceTimersByTime(KEEP_HISTORY_MS + DAY);
    await record("recent");

    await t.mutation(internal.housekeeping.pruneHistory, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const left = await t.run(async (ctx) => ({
      changes: (await ctx.db.query("changes").collect()).map(
        (change) => change.summary
      ),
      imports: (await ctx.db.query("imports").collect()).map(
        (entry) => entry.fileName
      ),
    }));
    expect(left).toEqual({ changes: ["recent"], imports: ["recent.html"] });
  });
});
