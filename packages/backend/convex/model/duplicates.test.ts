import { describe, expect, test as it } from "vitest";
import { findDuplicateGroups, samePageKey } from "./duplicates";

describe("samePageKey", () => {
  it("ignores scheme, www, fragments, trailing slashes and tracking parameters", () => {
    expect(samePageKey("http://www.Example.com/docs/?utm_source=x#top")).toBe(
      samePageKey("https://example.com/docs")
    );
  });

  it("ignores parameter order and index pages", () => {
    expect(samePageKey("https://example.com/index.html?b=2&a=1")).toBe(
      samePageKey("https://example.com/?a=1&b=2")
    );
  });

  it("keeps parameters that change the page", () => {
    expect(samePageKey("https://example.com/watch?v=1")).not.toBe(
      samePageKey("https://example.com/watch?v=2")
    );
  });
});

describe("findDuplicateGroups", () => {
  it("returns only groups of two or more, biggest first", () => {
    const groups = findDuplicateGroups([
      { url: "https://a.com/" },
      { url: "https://b.com/x" },
      { url: "http://www.b.com/x/" },
      { url: "https://b.com/x?utm_medium=mail" },
      { url: "https://c.com/" },
      { url: "https://c.com/#about" },
    ]);

    expect(groups.map((group) => group.bookmarks.length)).toEqual([3, 2]);
  });
});
