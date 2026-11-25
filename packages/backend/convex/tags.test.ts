import { describe, expect, test as it } from "vitest";
import { createTest } from "../testing/convex";
import { connectAgent } from "../testing/mcp";
import { libraryAsFileNodes } from "./model/backup";
import { parseBookmarkFile, serializeBookmarkFile } from "./model/netscape";
import { cleanTags } from "./model/tags";

interface Listed {
  tags: string[];
  title: string;
}
const titles = (result: { bookmarks: Listed[] }) =>
  result.bookmarks.map((bookmark) => bookmark.title);

async function researchLibrary() {
  const t = createTest();
  const agent = await connectAgent(t, "owner");
  const added = await agent.ok("add_bookmarks", {
    bookmarks: [
      { url: "https://a.example.com", title: "A" },
      { url: "https://b.example.com", title: "B", tags: ["Research"] },
      { url: "https://c.example.com", title: "C" },
    ],
  });
  const [a, b, c] = added.added.map((bookmark: { id: string }) => bookmark.id);
  return { t, agent, a, b, c };
}

describe("tags", () => {
  it("an agent marks bookmarks reviewed and skips them next time, without dropping them", async () => {
    const { agent, a, b } = await researchLibrary();

    const tagged = await agent.ok("tag_bookmarks", {
      bookmarkIds: [a, b],
      add: ["Reviewed"],
    });

    expect(tagged.changedCount).toBe(2);
    const unreviewed = await agent.ok("list_bookmarks", {
      withoutTags: ["reviewed"],
    });
    expect(titles(unreviewed)).toEqual(["C"]);
    const reviewed = await agent.ok("list_bookmarks", { tags: ["reviewed"] });
    expect(reviewed.bookmarks).toEqual([
      expect.objectContaining({ title: "B", tags: ["research", "reviewed"] }),
      expect.objectContaining({ title: "A", tags: ["reviewed"] }),
    ]);
    const all = await agent.ok("list_bookmarks");
    expect(all.bookmarks).toHaveLength(3);
  });

  it("tagging again changes nothing and records no change", async () => {
    const { agent, a } = await researchLibrary();
    await agent.ok("tag_bookmarks", { bookmarkIds: [a], add: ["reviewed"] });

    const again = await agent.ok("tag_bookmarks", {
      bookmarkIds: [a],
      add: ["reviewed"],
    });

    expect(again).toEqual({ changedCount: 0, changeId: null });
  });

  it("undo puts every bookmark's tags back as they were", async () => {
    const { agent, a, b } = await researchLibrary();
    const tagged = await agent.ok("tag_bookmarks", {
      bookmarkIds: [a, b],
      add: ["reviewed"],
      remove: ["research"],
    });

    await agent.ok("undo_change", { changeId: tagged.changeId });

    const listed = await agent.ok("list_bookmarks");
    expect(
      listed.bookmarks.map(({ title, tags }: Listed) => ({ title, tags }))
    ).toEqual([
      { title: "C", tags: [] },
      { title: "B", tags: ["research"] },
      { title: "A", tags: [] },
    ]);
    const changes = await agent.ok("list_changes", { limit: 1 });
    expect(changes.changes[0].summary).toBe(
      "Tagged 2 bookmarks “reviewed”, removed “research”"
    );
  });

  it("search matches tags and filters by them", async () => {
    const { agent, a } = await researchLibrary();
    await agent.ok("tag_bookmarks", { bookmarkIds: [a], add: ["reviewed"] });

    const byTag = await agent.ok("search_bookmarks", { query: "research" });
    const skipping = await agent.ok("search_bookmarks", {
      query: "example",
      withoutTags: ["reviewed"],
    });

    expect(titles(byTag)).toEqual(["B"]);
    expect(titles(skipping).sort()).toEqual(["B", "C"]);
  });

  it("list_tags counts the tags in use", async () => {
    const { agent, a, b } = await researchLibrary();
    await agent.ok("tag_bookmarks", { bookmarkIds: [a, b], add: ["reviewed"] });

    const listed = await agent.ok("list_tags");

    expect(listed.tags).toEqual([
      { name: "reviewed", bookmarkCount: 2 },
      { name: "research", bookmarkCount: 1 },
    ]);
  });

  it("update_bookmark replaces the tags and its undo restores them", async () => {
    const { agent, b } = await researchLibrary();

    const updated = await agent.ok("update_bookmark", {
      bookmarkId: b,
      tags: ["to read", "later"],
    });
    expect(updated.tags).toEqual(["later", "to read"]);

    await agent.ok("undo_change", { changeId: updated.changeId });
    const listed = await agent.ok("list_bookmarks", { tags: ["research"] });
    expect(titles(listed)).toEqual(["B"]);
  });

  it("a deleted bookmark comes back with its tags", async () => {
    const { agent, b } = await researchLibrary();
    const deleted = await agent.ok("delete_bookmark", { bookmarkId: b });

    await agent.ok("undo_change", { changeId: deleted.changeId });

    const listed = await agent.ok("list_bookmarks", { tags: ["research"] });
    expect(titles(listed)).toEqual(["B"]);
  });

  it("another user's bookmarks can't be tagged", async () => {
    const { t, b } = await researchLibrary();
    const intruder = await connectAgent(t, "intruder");

    const result = await intruder.call("tag_bookmarks", {
      bookmarkIds: [b],
      add: ["pwned"],
    });

    expect(result.content[0].text).toBe("Bookmark not found.");
  });

  it("a read-only connection can list tags but not change them", async () => {
    const { t, a } = await researchLibrary();
    const reader = await connectAgent(t, "owner", ["bookmarks:read"]);

    const read = await reader.request("list_tags");
    const write = await reader.request("tag_bookmarks", {
      bookmarkIds: [a],
      add: ["x"],
    });

    expect([read.status, write.status]).toEqual([200, 403]);
  });
});

describe("cleanTags", () => {
  it("lowercases, trims, splits on commas, drops blanks and duplicates, and sorts", () => {
    expect(cleanTags([" To  Read , reviewed", "REVIEWED", ""])).toEqual([
      "reviewed",
      "to read",
    ]);
  });

  it("refuses tags that are too long or too many", () => {
    expect(() => cleanTags(["x".repeat(41)])).toThrow(
      "A tag can be at most 40 characters."
    );
    expect(() =>
      cleanTags(Array.from({ length: 21 }, (_, index) => `tag ${index}`))
    ).toThrow("A bookmark can have at most 20 tags.");
  });
});

describe("bookmark files keep tags", () => {
  it("exports tags as TAGS and reads them back, as Firefox does", () => {
    const file = serializeBookmarkFile(
      libraryAsFileNodes(
        [],
        [
          {
            _id: "b1" as never,
            _creationTime: 0,
            userId: "u",
            url: "https://a.example.com/",
            title: "A",
            tags: ["research", "reviewed"],
            savedAt: 1000,
          },
        ]
      )
    );

    expect(file).toContain('TAGS="research,reviewed"');
    expect(parseBookmarkFile(file).children).toEqual([
      expect.objectContaining({ title: "A", tags: ["research", "reviewed"] }),
    ]);
  });
});
