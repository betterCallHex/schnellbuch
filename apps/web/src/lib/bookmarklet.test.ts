import { describe, expect, test as it } from "bun:test";
import { bookmarkletHref } from "./bookmarklet";

describe("bookmarkletHref", () => {
  it("opens the add page with the current page's URL and title", () => {
    const opened: string[] = [];
    const page = {
      location: { href: "https://example.com/a?b=1" },
      document: { title: "A & B" },
      window: { open: (url: string) => opened.push(url) },
      encodeURIComponent,
    };
    const body = decodeURIComponent(
      bookmarkletHref("https://schnellbuch.app").replace("javascript:", "")
    );

    new Function(...Object.keys(page), body)(...Object.values(page));

    expect(opened).toEqual([
      "https://schnellbuch.app/add?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&title=A%20%26%20B",
    ]);
  });
});
