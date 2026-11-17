import { describe, expect, test as it } from "bun:test";
import { bookmarksIn, displayHost, findSaved, sortBookmarks } from "./views";

const bookmarks = [
  { title: "Bun", folderId: "dev" },
  { title: "Essay", folderId: undefined },
  { title: "Convex", folderId: "dev" },
];

describe("views", () => {
  it("a folder holds only its own bookmarks", () => {
    expect(
      bookmarksIn(bookmarks, "dev").map((bookmark) => bookmark.title)
    ).toEqual(["Bun", "Convex"]);
  });

  it("the top level holds bookmarks outside every folder", () => {
    expect(
      bookmarksIn(bookmarks, undefined).map((bookmark) => bookmark.title)
    ).toEqual(["Essay"]);
  });

  it("hosts drop the www prefix", () => {
    expect(displayHost("https://www.example.com/page")).toBe("example.com");
  });
});

describe("findSaved", () => {
  const saved = [{ url: "https://bun.sh/" }, { url: "https://example.com/a" }];

  it("finds a link saved under the same normalized address", () => {
    expect(findSaved(saved, "bun.sh")).toEqual({ url: "https://bun.sh/" });
    expect(findSaved(saved, "  https://example.com/a ")).toEqual({
      url: "https://example.com/a",
    });
  });

  it("finds nothing for a new link or something that isn't one", () => {
    expect(findSaved(saved, "https://example.com/b")).toBeUndefined();
    expect(findSaved(saved, "not a link")).toBeUndefined();
  });
});

describe("sortBookmarks", () => {
  const unsorted = [
    { title: "item 10" },
    { title: "Apple" },
    { title: "item 9" },
  ];

  it("by name compares numbers as numbers and ignores case", () => {
    expect(sortBookmarks(unsorted, "name").map((b) => b.title)).toEqual([
      "Apple",
      "item 9",
      "item 10",
    ]);
  });

  it("by date saved keeps the newest-first order they arrive in", () => {
    expect(sortBookmarks(unsorted, "saved")).toBe(unsorted);
  });
});
