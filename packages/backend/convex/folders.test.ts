import { describe, expect, test as it } from "vitest";
import { createTest } from "../testing/convex";
import { api } from "./_generated/api";

describe("folders", () => {
  it("deleting a folder moves its bookmarks and subfolders up to its parent", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const convex = await owner.mutation(api.folders.create, {
      name: "Convex",
      parentId: dev,
    });
    const guides = await owner.mutation(api.folders.create, {
      name: "Guides",
      parentId: convex,
    });
    const bookmarkId = await owner.mutation(api.bookmarks.add, {
      url: "https://docs.convex.dev",
      title: "Convex docs",
      folderId: convex,
    });

    await owner.mutation(api.folders.remove, { folderId: convex });

    const folders = await owner.query(api.folders.list, {});
    const bookmarks = await owner.query(api.bookmarks.list, {});
    expect(folders.map((folder) => folder._id)).not.toContain(convex);
    expect(folders.find((folder) => folder._id === guides)?.parentId).toBe(dev);
    expect(
      bookmarks.find((bookmark) => bookmark._id === bookmarkId)?.folderId
    ).toBe(dev);
  });

  it("a folder can't move inside its own subfolder", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const convex = await owner.mutation(api.folders.create, {
      name: "Convex",
      parentId: dev,
    });

    await expect(
      owner.mutation(api.folders.update, { folderId: dev, parentId: convex })
    ).rejects.toThrow("A folder can't move inside itself.");
  });

  it("moving a folder to the top level clears its parent", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const convex = await owner.mutation(api.folders.create, {
      name: "Convex",
      parentId: dev,
    });

    await owner.mutation(api.folders.update, {
      folderId: convex,
      parentId: null,
    });

    const folders = await owner.query(api.folders.list, {});
    expect(
      folders.find((folder) => folder._id === convex)?.parentId
    ).toBeUndefined();
  });

  it("another user's folder is not found", async () => {
    const t = createTest();
    const dev = await t
      .withIdentity({ subject: "owner" })
      .mutation(api.folders.create, {
        name: "Dev",
      });

    await expect(
      t.withIdentity({ subject: "intruder" }).mutation(api.folders.update, {
        folderId: dev,
        name: "Mine now",
      })
    ).rejects.toThrow("Folder not found.");
  });

  it("a folder keeps the colour and mark it is given, and clears them on null", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });

    await owner.mutation(api.folders.update, {
      folderId: dev,
      color: "green",
      mark: { kind: "emoji", emoji: " 🚀 " },
    });
    const [styled] = await owner.query(api.folders.list, {});
    await owner.mutation(api.folders.update, {
      folderId: dev,
      color: null,
      mark: null,
    });
    const [plain] = await owner.query(api.folders.list, {});

    expect(styled?.color).toBe("green");
    expect(styled?.mark).toEqual({ kind: "emoji", emoji: "🚀" });
    expect(plain?.color).toBeUndefined();
    expect(plain?.mark).toBeUndefined();
    expect(plain?.name).toBe("Dev");
  });

  it("a folder mark must be an emoji", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });

    await expect(
      owner.mutation(api.folders.update, {
        folderId: dev,
        mark: { kind: "emoji", emoji: "ab" },
      })
    ).rejects.toThrow("Pick an emoji for the folder.");
  });

  it("duplicating a folder copies everything inside it, with its style", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, {
      name: "Dev",
      color: "purple",
      mark: { kind: "symbol", symbol: "code" },
    });
    const guides = await owner.mutation(api.folders.create, {
      name: "Guides",
      parentId: dev,
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://docs.convex.dev",
      title: "Convex docs",
      folderId: guides,
    });

    const copyId = await owner.mutation(api.folders.duplicate, {
      folderId: dev,
    });

    const folders = await owner.query(api.folders.list, {});
    const bookmarks = await owner.query(api.bookmarks.list, {});
    const copy = folders.find((folder) => folder._id === copyId);
    const copiedGuides = folders.find(
      (folder) => folder.parentId === copyId && folder.name === "Guides"
    );
    expect(copy).toMatchObject({
      name: "Dev copy",
      color: "purple",
      mark: { kind: "symbol", symbol: "code" },
    });
    expect(copy?.parentId).toBeUndefined();
    expect(copiedGuides).toBeDefined();
    expect(bookmarks.map((bookmark) => bookmark.folderId).toSorted()).toEqual(
      [guides, copiedGuides?._id].toSorted()
    );
  });

  it("a folder copied into another folder keeps its name", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const archive = await owner.mutation(api.folders.create, {
      name: "Archive",
    });

    const copyId = await owner.mutation(api.folders.duplicate, {
      folderId: dev,
      parentId: archive,
    });

    const copy = (await owner.query(api.folders.list, {})).find(
      (folder) => folder._id === copyId
    );
    expect(copy).toMatchObject({ name: "Dev", parentId: archive });
  });

  it("a folder can't be copied inside itself", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });

    await expect(
      owner.mutation(api.folders.duplicate, { folderId: dev, parentId: dev })
    ).rejects.toThrow("A folder can't move inside itself.");
  });

  it("removing a folder with its contents deletes everything inside it", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const guides = await owner.mutation(api.folders.create, {
      name: "Guides",
      parentId: dev,
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://docs.convex.dev",
      folderId: guides,
    });
    const kept = await owner.mutation(api.bookmarks.add, {
      url: "https://example.com",
    });

    await owner.mutation(api.folders.removeWithContents, { folderId: dev });

    expect(await owner.query(api.folders.list, {})).toEqual([]);
    expect(
      (await owner.query(api.bookmarks.list, {})).map(
        (bookmark) => bookmark._id
      )
    ).toEqual([kept]);
  });

  it("signed-out callers are rejected", async () => {
    const t = createTest();

    await expect(t.query(api.folders.list, {})).rejects.toThrow(
      "Sign in to continue."
    );
  });
});
