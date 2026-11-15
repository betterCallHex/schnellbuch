import { describe, expect, test as it } from "vitest";
import { createTest } from "../testing/convex";
import { api, internal } from "./_generated/api";

describe("saved dates", () => {
  it("new bookmarks get a saved date and list newest saved first", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    await owner.mutation(api.bookmarks.add, {
      url: "https://old.example.com",
      title: "Old",
      savedAt: Date.UTC(2015, 0, 1),
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://new.example.com",
      title: "New",
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://middle.example.com",
      title: "Middle",
      savedAt: Date.UTC(2020, 0, 1),
    });

    const bookmarks = await owner.query(api.bookmarks.list, {});
    expect(bookmarks.map((bookmark) => bookmark.title)).toEqual([
      "New",
      "Middle",
      "Old",
    ]);
    expect(bookmarks[0]?.savedAt).toBeGreaterThan(Date.UTC(2025, 0, 1));
  });

  it("the backfill fills in missing dates from creation time and can run again", async () => {
    const t = createTest();
    const ids = await t.run(async (ctx) => [
      await ctx.db.insert("bookmarks", {
        userId: "owner",
        url: "https://a.example.com/",
        title: "A",
      }),
      await ctx.db.insert("bookmarks", {
        userId: "owner",
        url: "https://b.example.com/",
        title: "B",
        savedAt: 1234,
      }),
    ]);

    const first = await t.mutation(internal.migrations.backfillSavedAt, {});
    const second = await t.mutation(internal.migrations.backfillSavedAt, {});

    expect(first).toEqual({ patched: 1, done: true });
    expect(second).toEqual({ patched: 0, done: true });
    const [a, b] = await t.run((ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id)))
    );
    expect(a?.savedAt).toBe(a?._creationTime);
    expect(b?.savedAt).toBe(1234);
  });
});
