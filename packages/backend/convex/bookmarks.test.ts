import { describe, expect, test as it } from "vitest";
import { createTest } from "../testing/convex";
import { api } from "./_generated/api";

describe("bookmarks", () => {
  it("a link without a scheme is saved as https with its host as a placeholder title", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    await owner.mutation(api.bookmarks.add, { url: "www.example.com/page" });

    const [bookmark] = await owner.query(api.bookmarks.list, {});
    expect(bookmark?.url).toBe("https://www.example.com/page");
    expect(bookmark?.title).toBe("example.com");
  });

  it("non-web links are refused", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    await expect(
      owner.mutation(api.bookmarks.add, { url: "javascript:alert(1)" })
    ).rejects.toThrow("is not a web link.");
  });

  it("moving a bookmark to null makes it unsorted", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const bookmarkId = await owner.mutation(api.bookmarks.add, {
      url: "https://bun.sh",
      title: "Bun",
      folderId: dev,
    });

    await owner.mutation(api.bookmarks.update, { bookmarkId, folderId: null });

    const [bookmark] = await owner.query(api.bookmarks.list, {});
    expect(bookmark?.folderId).toBeUndefined();
  });

  it("users only see their own bookmarks", async () => {
    const t = createTest();
    await t
      .withIdentity({ subject: "owner" })
      .mutation(api.bookmarks.add, { url: "https://bun.sh", title: "Bun" });

    const bookmarks = await t
      .withIdentity({ subject: "intruder" })
      .query(api.bookmarks.list, {});

    expect(bookmarks).toEqual([]);
  });

  it("a copied bookmark keeps everything but its folder, including who chose the URL", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const bookmarkId = await t.run((ctx) =>
      ctx.db.insert("bookmarks", {
        userId: "owner",
        url: "https://bun.sh",
        title: "Bun",
        savedAt: 1000,
        faviconUrl: "https://bun.sh/favicon.ico",
        urlFromAgent: true,
      })
    );

    const copyId = await owner.mutation(api.bookmarks.duplicate, {
      bookmarkId,
      folderId: dev,
    });

    const copy = await t.run((ctx) => ctx.db.get(copyId));
    expect(copy).toMatchObject({
      url: "https://bun.sh",
      title: "Bun",
      savedAt: 1000,
      faviconUrl: "https://bun.sh/favicon.ico",
      urlFromAgent: true,
      folderId: dev,
    });
  });
});
