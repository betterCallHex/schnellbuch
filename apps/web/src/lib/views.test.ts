import { describe, expect, test as it } from "bun:test";
import { bookmarksInView, displayHost, parseView } from "./views";

const bookmarks = [
  { title: "Bun", folderId: "dev" },
  { title: "Essay", folderId: undefined },
  { title: "Convex", folderId: "dev" },
];

describe("views", () => {
  it("a folder view shows only that folder's bookmarks", () => {
    expect(
      bookmarksInView(bookmarks, parseView("dev")).map(
        (bookmark) => bookmark.title
      )
    ).toEqual(["Bun", "Convex"]);
  });

  it("the unsorted view shows bookmarks outside every folder", () => {
    expect(
      bookmarksInView(bookmarks, parseView("unsorted")).map(
        (bookmark) => bookmark.title
      )
    ).toEqual(["Essay"]);
  });

  it("no folder means all bookmarks", () => {
    expect(bookmarksInView(bookmarks, parseView(undefined))).toHaveLength(3);
  });

  it("hosts drop the www prefix", () => {
    expect(displayHost("https://www.example.com/page")).toBe("example.com");
  });
});
