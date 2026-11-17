import { describe, expect, test as it } from "vitest";
import { searchBookmarks, searchFolders } from "./search";

const bookmarks = [
  { title: "Convex Developer Hub", url: "https://docs.convex.dev" },
  {
    title: "Bun — A fast all-in-one JavaScript runtime",
    url: "https://bun.sh",
  },
];

describe("searchBookmarks", () => {
  it("matches abbreviations that skip letters, across words", () => {
    expect(
      searchBookmarks(bookmarks, "cnvx hub", 10).map(
        (bookmark) => bookmark.title
      )
    ).toEqual(["Convex Developer Hub"]);
  });

  it("matches on the URL as well as the title", () => {
    expect(
      searchBookmarks(bookmarks, "bun.sh", 10).map((bookmark) => bookmark.title)
    ).toEqual(["Bun — A fast all-in-one JavaScript runtime"]);
  });

  it("falls back to typo matching when nothing matches as an abbreviation", () => {
    expect(
      searchBookmarks(bookmarks, "cinvex", 10).map((bookmark) => bookmark.title)
    ).toEqual(["Convex Developer Hub"]);
  });

  it("matches words in a bookmark's note", () => {
    expect(
      searchBookmarks(
        [
          ...bookmarks,
          {
            title: "Talk",
            url: "https://x.example",
            note: "about sync engines",
          },
        ],
        "sync engine",
        10
      ).map((bookmark) => bookmark.title)
    ).toEqual(["Talk"]);
  });

  it("an empty query returns the first bookmarks up to the limit", () => {
    expect(searchBookmarks(bookmarks, "  ", 1)).toHaveLength(1);
  });
});

describe("searchFolders", () => {
  it("matches abbreviations across a folder's whole path", () => {
    const folders = [
      { path: "Dev" },
      { path: "Dev / Convex" },
      { path: "Reading / Essays" },
    ];

    expect(
      searchFolders(folders, "dev cnvx", 10).map((folder) => folder.path)
    ).toEqual(["Dev / Convex"]);
  });
});
