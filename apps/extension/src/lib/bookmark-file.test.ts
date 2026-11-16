import { describe, expect, test as it } from "bun:test";
import { parseBookmarkFile } from "@schnellbuch/backend/netscape";
import { bookmarkFile } from "./bookmark-file";

const ADDED = Date.UTC(2024, 0, 2, 3, 4, 5);

describe("bookmarkFile", () => {
  it("a Chrome tree keeps its folders, nesting, titles, links and dates", () => {
    const html = bookmarkFile([
      {
        title: "",
        children: [
          {
            title: "Bookmarks bar",
            dateAdded: ADDED,
            children: [
              {
                title: "Dev",
                dateAdded: ADDED,
                children: [
                  {
                    title: "Tom & Jerry <3",
                    url: "https://example.com/?a=1&b=2",
                    dateAdded: ADDED,
                  },
                ],
              },
            ],
          },
          {
            title: "Other bookmarks",
            children: [
              {
                title: "Convex",
                url: "https://docs.convex.dev/",
              },
            ],
          },
          { title: "Mobile bookmarks", children: [] },
        ],
      },
    ]);

    expect(parseBookmarkFile(html).children).toEqual([
      {
        kind: "folder",
        title: "Bookmarks bar",
        addedAt: ADDED,
        children: [
          {
            kind: "folder",
            title: "Dev",
            addedAt: ADDED,
            children: [
              {
                kind: "bookmark",
                title: "Tom & Jerry <3",
                url: "https://example.com/?a=1&b=2",
                addedAt: ADDED,
              },
            ],
          },
        ],
      },
      {
        kind: "folder",
        title: "Other bookmarks",
        addedAt: undefined,
        children: [
          {
            kind: "bookmark",
            title: "Convex",
            url: "https://docs.convex.dev/",
            addedAt: undefined,
          },
        ],
      },
    ]);
  });

  it("a Firefox tree drops separators and keeps place: queries for the import to count", () => {
    const html = bookmarkFile([
      {
        title: "",
        children: [
          {
            title: "Bookmarks Toolbar",
            children: [
              {
                title: "Most Visited",
                url: "place:sort=8&maxResults=10",
              },
              { title: "", type: "separator" },
              {
                title: "MDN",
                url: "https://developer.mozilla.org/",
              },
            ],
          },
        ],
      },
    ]);

    const [toolbar] = parseBookmarkFile(html).children;
    expect(toolbar).toMatchObject({
      title: "Bookmarks Toolbar",
      children: [
        { kind: "bookmark", url: "place:sort=8&maxResults=10" },
        { kind: "bookmark", url: "https://developer.mozilla.org/" },
      ],
    });
  });
});
