// Regression tests for the MCP security audit (#11). Each one failed before
// its fix. Every test connects two agents for different users.
import { afterEach, describe, expect, test as it, vi } from "vitest";
import { createTest } from "../testing/convex";
import { connectAgent } from "../testing/mcp";
import { api } from "./_generated/api";

type TestClient = ReturnType<typeof createTest>;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function recordFetches() {
  const fetched: string[] = [];
  vi.stubGlobal("fetch", (input: string | URL | Request) => {
    fetched.push(input instanceof Request ? input.url : String(input));
    return Promise.resolve(
      new Response("<title>Fetched title</title>", {
        headers: { "content-type": "text/html" },
      })
    );
  });
  return fetched;
}

async function twoAgents(t: TestClient) {
  return {
    ada: await connectAgent(t, "ada"),
    bob: await connectAgent(t, "bob"),
  };
}

describe("audit 1: the backend never opens a link an agent chose", () => {
  it("add_bookmark and add_bookmarks don't fetch the URL, so data in it can't leave", async () => {
    vi.useFakeTimers();
    const fetched = recordFetches();
    const t = createTest();
    const { ada, bob } = await twoAgents(t);
    const exfil = "https://collector.example.net/c?d=private-share-link";

    const single = await ada.ok("add_bookmark", { url: exfil });
    await bob.ok("add_bookmarks", {
      bookmarks: [{ url: `${exfil}&from=bulk` }],
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetched.filter((url) => url.includes("collector"))).toEqual([]);
    expect(single).toMatchObject({ title: "collector.example.net" });
  });

  it("update_bookmark pointing a link elsewhere doesn't fetch it either, and check_links skips it", async () => {
    vi.useFakeTimers();
    const fetched = recordFetches();
    const t = createTest();
    const { ada, bob } = await twoAgents(t);
    const bookmarkId = await t
      .withIdentity({ subject: "ada" })
      .mutation(api.bookmarks.add, {
        url: "https://user-saved.example.com",
        title: "Saved by Ada",
      });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    fetched.length = 0;

    await ada.ok("update_bookmark", {
      bookmarkId,
      url: "https://collector.example.net/c?d=secret",
    });
    await ada.ok("add_bookmark", { url: "https://collector.example.net/2" });
    const queued = await ada.ok("check_links");
    await bob.ok("check_links");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetched.filter((url) => url.includes("collector"))).toEqual([]);
    expect(queued.queued).toBe(0);
  });

  it("links the user saves in the app are still fetched and checked", async () => {
    vi.useFakeTimers();
    const fetched = recordFetches();
    const t = createTest();
    const { ada } = await twoAgents(t);
    await t.withIdentity({ subject: "ada" }).mutation(api.bookmarks.add, {
      url: "https://user-saved.example.com",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const queued = await ada.ok("check_links");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(queued.queued).toBe(1);
    expect(
      fetched.filter((url) => url.startsWith("https://user-saved.example.com"))
    ).toHaveLength(2);
    const [bookmark] = await t
      .withIdentity({ subject: "ada" })
      .query(api.bookmarks.list, {});
    expect(bookmark?.title).toBe("Fetched title");
  });
});

describe("audit 2: results stay small", () => {
  it("list_folders pages instead of returning every folder at once", async () => {
    const t = createTest();
    const { ada, bob } = await twoAgents(t);
    await t.run((ctx) =>
      Promise.all(
        Array.from({ length: 300 }, (_, i) =>
          ctx.db.insert("folders", {
            userId: "ada",
            name: `Imported folder ${String(i).padStart(3, "0")}`,
          })
        )
      )
    );

    const first = await ada.request("list_folders");
    const firstBody = await first.text();
    const page = JSON.parse(firstBody).result.structuredContent;
    const next = await ada.ok("list_folders", { cursor: page.nextCursor });
    const found = await ada.ok("list_folders", { query: "folder 123" });
    const bobs = await bob.ok("list_folders");

    expect(firstBody.length).toBeLessThan(60_000);
    expect(page.folders).toHaveLength(100);
    expect(next.folders[0].name).toBe("Imported folder 100");
    expect(found.folders.map((f: { name: string }) => f.name)).toEqual([
      "Imported folder 123",
    ]);
    expect(bobs).toEqual({ folders: [], nextCursor: null });
  });

  it("huge titles and names are refused", async () => {
    const t = createTest();
    const { ada, bob } = await twoAgents(t);
    const huge = "x".repeat(500_000);

    const bookmark = await ada.call("add_bookmark", {
      url: "https://example.com",
      title: huge,
    });
    const folder = await bob.call("create_folder", { name: huge });

    expect(bookmark.content[0].text).toBe(
      "A title can be at most 1000 characters."
    );
    expect(folder.content[0].text).toBe(
      "A folder name can be at most 200 characters."
    );
    expect((await ada.ok("list_bookmarks")).bookmarks).toEqual([]);
  });
});

describe("audit 3: check_links can't be used to hammer sites", () => {
  it("a link checked in the last hour isn't checked again", async () => {
    vi.useFakeTimers();
    recordFetches();
    const t = createTest();
    const { ada, bob } = await twoAgents(t);
    await t.withIdentity({ subject: "ada" }).mutation(api.bookmarks.add, {
      url: "https://user-saved.example.com",
    });
    await t.withIdentity({ subject: "bob" }).mutation(api.bookmarks.add, {
      url: "https://user-saved.example.com",
    });

    const first = await ada.ok("check_links");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const again = await ada.ok("check_links");
    const bobs = await bob.ok("check_links");

    expect([first.queued, again.queued, bobs.queued]).toEqual([1, 0, 1]);
  });
});
