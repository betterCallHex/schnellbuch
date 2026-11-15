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

  it("signed-out callers are rejected", async () => {
    const t = createTest();

    await expect(t.query(api.folders.list, {})).rejects.toThrow(
      "Sign in to continue."
    );
  });
});
