import { afterEach, describe, expect, test as it, vi } from "vitest";
import { createTest } from "../testing/convex";
import { connectAgent } from "../testing/mcp";
import { api } from "./_generated/api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("bulk agent tools", () => {
  it("add_bookmarks saves many links at once, skips ones already saved, and undoes in one step", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const folder = await owner.ok("create_folder", { name: "Reading" });
    await owner.ok("add_bookmark", { url: "https://a.example.com" });

    const result = await owner.ok("add_bookmarks", {
      folderId: folder.id,
      bookmarks: [
        { url: "https://a.example.com", title: "A again" },
        { url: "b.example.com", title: "B" },
        { url: "https://c.example.com/", title: "C" },
        { url: "https://c.example.com", title: "C twice" },
        { url: "javascript:alert(1)" },
      ],
    });

    expect(result.added).toEqual([
      expect.objectContaining({ title: "B", folderPath: "Reading" }),
      expect.objectContaining({ title: "C", folderPath: "Reading" }),
    ]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        url: "https://a.example.com",
        reason: "already saved",
      }),
      expect.objectContaining({ reason: "already saved" }),
      {
        url: "javascript:alert(1)",
        reason: "not a web link",
        existingId: null,
      },
    ]);

    await owner.ok("undo_change", { changeId: result.changeId });
    const listed = await owner.ok("list_bookmarks");
    expect(listed.bookmarks.map((b: { url: string }) => b.url)).toEqual([
      "https://a.example.com/",
    ]);
  });

  it("move_items moves bookmarks and folders together, and undo puts them back", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const inbox = await owner.ok("create_folder", { name: "Inbox" });
    const dev = await owner.ok("create_folder", { name: "Dev" });
    const tools = await owner.ok("create_folder", {
      name: "Tools",
      parentId: inbox.id,
    });
    const bun = await owner.ok("add_bookmark", {
      url: "https://bun.sh",
      title: "Bun",
      folderId: inbox.id,
    });
    const top = await owner.ok("add_bookmark", {
      url: "https://convex.dev",
      title: "Convex",
    });

    const moved = await owner.ok("move_items", {
      bookmarkIds: [bun.id, top.id],
      folderIds: [tools.id],
      toFolderId: dev.id,
    });

    expect(moved).toMatchObject({ movedCount: 3, destination: "Dev" });
    const folders = await owner.ok("list_folders");
    expect(folders.folders.map((f: { path: string }) => f.path)).toEqual([
      "Dev",
      "Dev / Tools",
      "Inbox",
    ]);

    await owner.ok("undo_change", { changeId: moved.changeId });

    const after = await owner.ok("list_bookmarks");
    expect(
      after.bookmarks.map((b: { title: string; folderPath: string | null }) => [
        b.title,
        b.folderPath,
      ])
    ).toEqual([
      ["Convex", null],
      ["Bun", "Inbox"],
    ]);
    expect(
      (await owner.ok("list_folders")).folders.map(
        (f: { path: string }) => f.path
      )
    ).toEqual(["Dev", "Inbox", "Inbox / Tools"]);
    const second = await owner.call("undo_change", {
      changeId: moved.changeId,
    });
    expect(second.content[0].text).toBe("That change was already undone.");
  });

  it("a folder can't be moved inside itself, and nothing moves when one item fails", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const parent = await owner.ok("create_folder", { name: "Parent" });
    const child = await owner.ok("create_folder", {
      name: "Child",
      parentId: parent.id,
    });
    const bookmark = await owner.ok("add_bookmark", { url: "https://x.dev" });

    const result = await owner.call("move_items", {
      bookmarkIds: [bookmark.id],
      folderIds: [parent.id],
      toFolderId: child.id,
    });

    expect(result.content[0].text).toBe("A folder can't move inside itself.");
    const listed = await owner.ok("list_bookmarks");
    expect(listed.bookmarks[0].folderId).toBeNull();
  });

  it("delete_bookmarks deletes in bulk and undo restores titles, folders and dates", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const folder = await owner.ok("create_folder", { name: "Old" });
    const saved = await owner.ok("add_bookmarks", {
      folderId: folder.id,
      bookmarks: [
        { url: "https://one.example.com", title: "One" },
        { url: "https://two.example.com", title: "Two" },
      ],
    });
    const before = await owner.ok("list_bookmarks");

    const deleted = await owner.ok("delete_bookmarks", {
      bookmarkIds: saved.added.map((b: { id: string }) => b.id),
    });
    expect(deleted.deletedCount).toBe(2);
    expect((await owner.ok("list_bookmarks")).bookmarks).toEqual([]);

    await owner.ok("undo_change", { changeId: deleted.changeId });

    const restored = await owner.ok("list_bookmarks");
    const shape = (bookmarks: Record<string, string>[]) =>
      bookmarks
        .map((b) => [b.title, b.url, b.folderPath, b.savedAt])
        .toSorted((first, second) =>
          String(first[1]).localeCompare(String(second[1]))
        );
    expect(shape(restored.bookmarks)).toEqual(shape(before.bookmarks));
  });

  it("the user can undo an agent's change from the app", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    await owner.ok("add_bookmarks", {
      bookmarks: [{ url: "https://spam.example.com", title: "Spam" }],
    });
    const asOwner = t.withIdentity({ subject: "owner" });

    const [change] = await asOwner.query(api.changes.list, {});
    expect(change).toMatchObject({
      summary: "Added 1 bookmark to the top level",
      undone: false,
    });
    await asOwner.mutation(api.changes.undo, { changeId: change?.id as never });

    expect(await asOwner.query(api.bookmarks.list, {})).toEqual([]);
    expect(await owner.ok("list_changes")).toMatchObject({
      changes: [{ undone: true }],
    });
  });

  it("bulk calls are capped", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");

    const result = await owner.call("add_bookmarks", {
      bookmarks: Array.from({ length: 201 }, (_, i) => ({
        url: `https://example.com/${i}`,
      })),
    });

    expect(result.content[0].text).toContain("At most 200 items per call.");
  });
});

describe("finding things", () => {
  it("list_bookmarks pages with nextCursor", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    await owner.ok("add_bookmarks", {
      bookmarks: Array.from({ length: 5 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: `Page ${i}`,
      })),
    });

    const first = await owner.ok("list_bookmarks", { limit: 2 });
    const second = await owner.ok("list_bookmarks", {
      limit: 2,
      cursor: first.nextCursor,
    });
    const last = await owner.ok("list_bookmarks", {
      limit: 2,
      cursor: second.nextCursor,
    });

    const ids = [first, second, last].flatMap((page) =>
      page.bookmarks.map((b: { id: string }) => b.id)
    );
    expect(new Set(ids).size).toBe(5);
    expect(last.nextCursor).toBeNull();
  });

  it("search_bookmarks can stay inside one folder and its subfolders", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const dev = await owner.ok("create_folder", { name: "Dev" });
    const docs = await owner.ok("create_folder", {
      name: "Docs",
      parentId: dev.id,
    });
    await owner.ok("add_bookmark", {
      url: "https://docs.convex.dev",
      title: "Convex docs",
      folderId: docs.id,
    });
    await owner.ok("add_bookmark", {
      url: "https://convex.dev/pricing",
      title: "Convex pricing",
    });

    const inDev = await owner.ok("search_bookmarks", {
      query: "convex",
      folderId: dev.id,
    });

    expect(inDev.bookmarks.map((b: { title: string }) => b.title)).toEqual([
      "Convex docs",
    ]);
  });

  it("find_duplicates groups links that open the same page", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    await owner.ok("add_bookmarks", {
      bookmarks: [
        { url: "https://example.com/post", title: "Post" },
        {
          url: "http://www.example.com/post/?utm_source=feed",
          title: "Post (feed)",
        },
        { url: "https://example.com/other", title: "Other" },
      ],
    });

    const result = await owner.ok("find_duplicates");

    expect(result.groups).toEqual([
      {
        bookmarks: expect.arrayContaining([
          expect.objectContaining({ title: "Post" }),
          expect.objectContaining({ title: "Post (feed)" }),
        ]),
      },
    ]);
  });

  it("check_links finds pages that are gone in the background", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (url: string) => {
      if (url.includes("gone")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      if (url.includes("dead-domain")) {
        return Promise.reject(new TypeError("fetch failed"));
      }
      return Promise.resolve(
        new Response("<title>Fine</title>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      );
    });
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    await t.run((ctx) =>
      Promise.all(
        [
          "https://fine.example.com/",
          "https://gone.example.com/page",
          "https://dead-domain.example/",
        ].map((url) =>
          ctx.db.insert("bookmarks", {
            userId: "owner",
            url,
            title: url,
            savedAt: 1,
          })
        )
      )
    );

    const queued = await owner.ok("check_links");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const broken = await owner.ok("find_broken_links");

    expect(queued.queued).toBe(3);
    expect(broken.checkedCount).toBe(3);
    expect(
      broken.bookmarks.map((b: { url: string; status: string }) => [
        b.url,
        b.status,
      ])
    ).toEqual(
      expect.arrayContaining([
        ["https://gone.example.com/page", "gone"],
        ["https://dead-domain.example/", "gone"],
      ])
    );
    expect(broken.bookmarks).toHaveLength(2);
  });
});

describe("new tools respect ownership and scopes", () => {
  it("another user's IDs can't be moved, deleted or undone", async () => {
    const t = createTest();
    const owner = await connectAgent(t, "owner");
    const intruder = await connectAgent(t, "intruder");
    const folder = await owner.ok("create_folder", { name: "Private" });
    const added = await owner.ok("add_bookmarks", {
      bookmarks: [{ url: "https://secret.example.com", title: "Secret" }],
    });
    const secretId = added.added[0].id;
    const mine = await intruder.ok("create_folder", { name: "Mine" });

    const move = await intruder.call("move_items", {
      bookmarkIds: [secretId],
      folderIds: [folder.id],
      toFolderId: mine.id,
    });
    const remove = await intruder.call("delete_bookmarks", {
      bookmarkIds: [secretId],
    });
    const undo = await intruder.call("undo_change", {
      changeId: added.changeId,
    });
    const intoForeignFolder = await intruder.call("add_bookmarks", {
      folderId: folder.id,
      bookmarks: [{ url: "https://planted.example.com" }],
    });
    const duplicates = await intruder.ok("find_duplicates");
    const changes = await intruder.ok("list_changes");

    expect(move.content[0].text).toBe("Bookmark not found.");
    expect(remove.content[0].text).toBe("Bookmark not found.");
    expect(undo.content[0].text).toBe(
      "Change not found. Call list_changes to see recent changes."
    );
    expect(intoForeignFolder.content[0].text).toBe("Folder not found.");
    expect(duplicates.groups).toEqual([]);
    expect(changes.changes).toEqual([]);
    const ownerView = await owner.ok("list_bookmarks");
    expect(ownerView.bookmarks).toEqual([
      expect.objectContaining({ title: "Secret", folderId: null }),
    ]);
  });

  it("a read-only connection can find things but not change them", async () => {
    const t = createTest();
    const reader = await connectAgent(t, "owner", ["bookmarks:read"]);

    const reads = await Promise.all(
      ["find_duplicates", "find_broken_links", "list_changes"].map((name) =>
        reader.request(name)
      )
    );
    const writes = await Promise.all(
      [
        ["add_bookmarks", { bookmarks: [] }],
        ["move_items", { bookmarkIds: [], toFolderId: null }],
        ["delete_bookmarks", { bookmarkIds: [] }],
        ["undo_change", { changeId: "x" }],
        ["check_links", {}],
      ].map(([name, args]) =>
        reader.request(name as string, args as Record<string, unknown>)
      )
    );

    expect(reads.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(writes.map((response) => response.status)).toEqual([
      403, 403, 403, 403, 403,
    ]);
  });
});
