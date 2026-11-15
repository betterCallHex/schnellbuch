import { describe, expect, test as it } from "bun:test";
import { bookmarksIn, displayHost } from "./views";

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
