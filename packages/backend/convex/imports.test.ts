import { afterEach, describe, expect, test as it, vi } from "vitest";
import { createTest } from "../testing/convex";
import chromeExport from "../testing/fixtures/chrome.html?raw";
import firefoxExport from "../testing/fixtures/firefox.html?raw";
import safariExport from "../testing/fixtures/safari.html?raw";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { IMPORT_BATCH_SIZE } from "./model/import";
import { type FileNode, serializeBookmarkFile } from "./model/netscape";

type TestClient = ReturnType<typeof createTest>;

const DAY = new Date().toISOString().slice(0, "YYYY-MM-DD".length);
const SECOND = 1000;
const THIS_TESTS_SITES = /^https:\/\/[ab]\.example\.com\//u;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("import", () => {
  it("an export imported back gives the same tree, titles, links and dates", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const dev = await owner.mutation(api.folders.create, { name: "Dev" });
    const convex = await owner.mutation(api.folders.create, {
      name: "Convex",
      parentId: dev,
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://docs.convex.dev/",
      title: "Convex docs",
      folderId: convex,
      savedAt: Date.UTC(2021, 2, 3),
    });
    await owner.mutation(api.bookmarks.add, {
      url: "https://example.com/",
      title: "Top & level",
      savedAt: Date.UTC(2022, 4, 5),
    });
    const before = await libraryTree(t, "owner");
    const html = await owner.query(api.bookmarks.exportFile, {});

    const summary = await t
      .withIdentity({ subject: "fresh" })
      .action(api.imports.start, { fileName: "backup.html", html });

    expect(summary).toMatchObject({
      status: "done",
      source: "SchnellBuch",
      total: 2,
      imported: 2,
      duplicates: 0,
      nonWeb: 0,
    });
    expect((await libraryTree(t, "fresh")).folders).toEqual([
      {
        name: `Imported from SchnellBuch ${DAY}`,
        bookmarks: before.bookmarks,
        folders: before.folders,
      },
    ]);
  });

  it("a Chrome export keeps its folders, skips non-web links and duplicates", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    const summary = await owner.action(api.imports.start, {
      fileName: "bookmarks_11_15_26.html",
      html: chromeExport,
    });

    expect(summary).toMatchObject({
      source: "Chrome",
      total: 6,
      imported: 3,
      duplicates: 1,
      nonWeb: 2,
      failed: 0,
    });
    expect((await libraryTree(t, "owner")).folders).toEqual([
      {
        name: `Imported from Chrome ${DAY}`,
        bookmarks: [],
        folders: [
          {
            name: "Bookmarks bar",
            bookmarks: [
              {
                title: "Convex Developer Hub",
                url: "https://docs.convex.dev/",
                savedAt: 1_650_000_000 * SECOND,
              },
            ],
            folders: [
              {
                name: "Dev",
                bookmarks: [
                  {
                    title: "Bun — A fast all-in-one JavaScript runtime",
                    url: "https://bun.sh/",
                    savedAt: 1_660_000_000 * SECOND,
                  },
                ],
                folders: [],
              },
            ],
          },
          {
            name: "Other bookmarks",
            bookmarks: [
              {
                title: "Tom & Jerry",
                url: "https://example.com/?q=a&b=c",
                savedAt: 1_660_000_003 * SECOND,
              },
            ],
            folders: [],
          },
        ],
      },
    ]);
  });

  it("the browser the import came from names its folder over what the file looks like", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    const summary = await owner.action(api.imports.start, {
      fileName: "Brave bookmarks",
      html: chromeExport,
      source: "Brave",
    });

    expect(summary).toMatchObject({ source: "Brave", imported: 3 });
    expect(
      (await libraryTree(t, "owner")).folders.map(({ name }) => name)
    ).toEqual([`Imported from Brave ${DAY}`]);
  });

  it("a source outside the known browsers is refused before anything is written", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    await expect(
      owner.action(api.imports.start, {
        fileName: "bookmarks.html",
        html: chromeExport,
        source: "Netscape Navigator" as "Chrome",
      })
    ).rejects.toThrow();

    expect(await libraryTree(t, "owner")).toEqual({
      folders: [],
      bookmarks: [],
    });
  });

  it("a Firefox export skips place: queries and keeps descriptions out of titles", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    const summary = await owner.action(api.imports.start, {
      fileName: "bookmarks.html",
      html: firefoxExport,
    });

    expect(summary).toMatchObject({
      source: "Firefox",
      imported: 3,
      nonWeb: 1,
    });
    const [root] = (await libraryTree(t, "owner")).folders;
    expect(root?.name).toBe(`Imported from Firefox ${DAY}`);
    expect(root?.folders.map((folder) => folder.name)).toEqual([
      "Bookmarks Toolbar",
      "Mozilla Firefox",
      "Other Bookmarks",
    ]);
    expect(root?.folders[0]?.bookmarks).toEqual([
      {
        title: "MDN Web Docs",
        url: "https://developer.mozilla.org/",
        savedAt: 1_655_000_000 * SECOND,
      },
    ]);
  });

  it("a Safari export without dates nests its folders and dates bookmarks now", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const startedAt = Date.now();

    const summary = await owner.action(api.imports.start, {
      fileName: "Safari Bookmarks.html",
      html: safariExport,
    });

    expect(summary).toMatchObject({ source: "Safari", imported: 3 });
    const [root] = (await libraryTree(t, "owner")).folders;
    expect(root?.folders.map((folder) => folder.name)).toEqual([
      "Bookmarks Menu",
      "Favorites",
      "Reading List",
    ]);
    const favorites = root?.folders[1];
    expect(favorites?.bookmarks.map((bookmark) => bookmark.title)).toEqual([
      "Apple",
    ]);
    expect(favorites?.folders[0]).toMatchObject({
      name: "News",
      bookmarks: [expect.objectContaining({ title: "Hacker News" })],
    });
    expect(favorites?.bookmarks[0]?.savedAt).toBeGreaterThanOrEqual(startedAt);
  });

  it("links already saved before the import are counted as duplicates", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.bookmarks.add, {
      url: "bun.sh",
      title: "Saved earlier",
    });

    const summary = await owner.action(api.imports.start, {
      fileName: "chrome.html",
      html: chromeExport,
    });

    expect(summary).toMatchObject({ imported: 2, duplicates: 2 });
    const bun = (await owner.query(api.bookmarks.list, {})).filter(
      (bookmark) => bookmark.url === "https://bun.sh/"
    );
    expect(bun.map((bookmark) => bookmark.title)).toEqual(["Saved earlier"]);
  });

  it("a file that isn't a bookmarks export fails clearly and writes nothing", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });

    await expect(
      owner.action(api.imports.start, {
        fileName: "notes.html",
        html: "<html><body><p>Just a page with a <a href='https://x.com'>link</a></p></body></html>",
      })
    ).rejects.toThrow("That file isn't a bookmarks export.");
    await expect(
      owner.action(api.imports.start, {
        fileName: "empty.html",
        html: "<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p></DL><p>",
      })
    ).rejects.toThrow("That bookmarks file is empty.");

    expect(await libraryTree(t, "owner")).toEqual({
      folders: [],
      bookmarks: [],
    });
    expect(await owner.query(api.imports.latest, {})).toBeNull();
  });

  it("a large file imports completely across several batches", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const count = IMPORT_BATCH_SIZE * 3 + 17;
    const folders: FileNode[] = Array.from({ length: 6 }, (_, folder) => ({
      kind: "folder",
      title: `Folder ${folder}`,
      children: Array.from(
        { length: Math.ceil(count / 6) },
        (_unused, index): FileNode => ({
          kind: "bookmark",
          title: `Page ${folder}-${index}`,
          url: `https://example.com/${folder}/${index}`,
          addedAt: Date.UTC(2020, 0, 1) + index * SECOND,
        })
      ),
    }));

    const summary = await owner.action(api.imports.start, {
      fileName: "big.html",
      html: serializeBookmarkFile(folders),
    });

    const expected = Math.ceil(count / 6) * 6;
    expect(summary).toMatchObject({
      status: "done",
      total: expected,
      imported: expected,
    });
    expect(await owner.query(api.bookmarks.list, {})).toHaveLength(expected);
    expect(await owner.query(api.imports.latest, {})).toMatchObject({
      status: "done",
      imported: expected,
    });
  });

  it("titles and icons fill in afterwards, one page per site for icons, without replacing imported titles", async () => {
    vi.useFakeTimers();
    const fetched: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      fetched.push(url);
      return Promise.resolve(
        new Response(
          "<html><head><title>A page title from the web</title><link rel='icon' href='/icon.png'></head></html>",
          { headers: { "content-type": "text/html" } }
        )
      );
    });
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const html = serializeBookmarkFile([
      {
        kind: "bookmark",
        title: "My own name",
        url: "https://a.example.com/1",
      },
      { kind: "bookmark", title: "Also named", url: "https://a.example.com/2" },
      { kind: "bookmark", title: "", url: "https://b.example.com" },
    ]);

    await owner.action(api.imports.start, { fileName: "x.html", html });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // Other tests' scheduled jobs can land here too; look only at ours.
    expect(
      fetched.filter((url) => THIS_TESTS_SITES.test(url)).toSorted()
    ).toEqual(["https://a.example.com/1", "https://b.example.com/"]);
    const bookmarks = await owner.query(api.bookmarks.list, {});
    expect(
      bookmarks.map(({ title, faviconUrl }) => ({ title, faviconUrl }))
    ).toEqual(
      expect.arrayContaining([
        { title: "My own name", faviconUrl: "https://a.example.com/icon.png" },
        { title: "Also named", faviconUrl: "https://a.example.com/icon.png" },
        {
          title: "A page title from the web",
          faviconUrl: "https://b.example.com/icon.png",
        },
      ])
    );
  });

  it("notes travel with an export and come back on import", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.bookmarks.add, {
      url: "https://bun.sh",
      title: "Bun",
      note: "Fast <JS> runtime & friends",
    });
    const html = await owner.query(api.bookmarks.exportFile, {});

    expect(html).toContain("<DD>Fast &lt;JS&gt; runtime &amp; friends");
    await t
      .withIdentity({ subject: "fresh" })
      .action(api.imports.start, { fileName: "backup.html", html });

    const [imported] = await t
      .withIdentity({ subject: "fresh" })
      .query(api.bookmarks.list, {});
    expect(imported?.note).toBe("Fast <JS> runtime & friends");
  });

  it("a few imports in a row are fine, then they wait", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const html = serializeBookmarkFile([
      { kind: "bookmark", title: "One", url: "https://one.example.com" },
    ]);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: imports run one after another
      await owner.action(api.imports.start, { fileName: "x.html", html });
    }

    await expect(
      owner.action(api.imports.start, { fileName: "x.html", html })
    ).rejects.toThrow("Too many imports in a short time.");
  });

  it("another user's library is never touched", async () => {
    const t = createTest();
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.folders.create, { name: "Mine" });
    await owner.mutation(api.bookmarks.add, {
      url: "https://bun.sh",
      title: "Owner's Bun",
    });
    const before = await libraryTree(t, "owner");

    const summary = await t
      .withIdentity({ subject: "other" })
      .action(api.imports.start, { fileName: "c.html", html: chromeExport });

    expect(summary).toMatchObject({ imported: 3, duplicates: 1 });
    expect(await libraryTree(t, "owner")).toEqual(before);
    expect(await owner.query(api.imports.latest, {})).toBeNull();
  });

  it("needs a signed-in user", async () => {
    const t = createTest();

    await expect(
      t.action(api.imports.start, { fileName: "c.html", html: chromeExport })
    ).rejects.toThrow("Sign in to continue.");
  });
});

interface TreeFolder {
  bookmarks: { title: string; url: string; savedAt: number | undefined }[];
  folders: TreeFolder[];
  name: string;
}

async function libraryTree(t: TestClient, userId: string) {
  const { folders, bookmarks } = await t.run(async (ctx) => ({
    folders: await ctx.db
      .query("folders")
      .withIndex("by_user_parent", (q) => q.eq("userId", userId))
      .collect(),
    bookmarks: await ctx.db
      .query("bookmarks")
      .withIndex("by_user_folder", (q) => q.eq("userId", userId))
      .collect(),
  }));
  const build = (parentId: Doc<"folders">["_id"] | undefined): TreeFolder[] =>
    folders
      .filter((folder) => folder.parentId === parentId)
      .toSorted((first, second) => first.name.localeCompare(second.name))
      .map((folder) => ({
        name: folder.name,
        bookmarks: bookmarksIn(folder._id),
        folders: build(folder._id),
      }));
  const bookmarksIn = (folderId: Doc<"folders">["_id"] | undefined) =>
    bookmarks
      .filter((bookmark) => bookmark.folderId === folderId)
      .map(({ title, url, savedAt }) => ({ title, url, savedAt }))
      .toSorted((first, second) => first.url.localeCompare(second.url));
  return { folders: build(undefined), bookmarks: bookmarksIn(undefined) };
}
