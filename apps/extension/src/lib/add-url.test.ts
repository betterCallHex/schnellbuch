import { describe, expect, test as it } from "bun:test";
import { addPageUrl, isSavable, normalizeServerUrl } from "./add-url";

describe("addPageUrl", () => {
  it("opens /add with the page's URL and title, encoded", () => {
    expect(
      addPageUrl("https://bookmarks.example.com/", {
        url: "https://example.com/a?b=c&d=e",
        title: "  Tom & Jerry  ",
      })
    ).toBe(
      "https://bookmarks.example.com/add?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3Dc%26d%3De&title=Tom+%26+Jerry"
    );
  });

  it("leaves out an empty title so the page's own title is fetched", () => {
    expect(
      addPageUrl("http://localhost:3000", { url: "https://x.dev", title: " " })
    ).toBe("http://localhost:3000/add?url=https%3A%2F%2Fx.dev");
  });

  it("works with SchnellBuch hosted under a path", () => {
    expect(addPageUrl("https://example.com/sb", { url: "https://x.dev" })).toBe(
      "https://example.com/sb/add?url=https%3A%2F%2Fx.dev"
    );
  });
});

describe("normalizeServerUrl", () => {
  it("adds https and drops a trailing slash", () => {
    expect(normalizeServerUrl("bookmarks.example.com/")).toBe(
      "https://bookmarks.example.com"
    );
    expect(normalizeServerUrl(" http://localhost:3000 ")).toBe(
      "http://localhost:3000"
    );
  });

  it("refuses addresses that aren't web addresses", () => {
    expect(normalizeServerUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeServerUrl("ftp://example.com")).toBeUndefined();
    expect(normalizeServerUrl("")).toBeUndefined();
  });
});

describe("isSavable", () => {
  it("only web pages can be saved", () => {
    expect(isSavable("https://example.com")).toBe(true);
    expect(isSavable("chrome://newtab/")).toBe(false);
    expect(isSavable("about:blank")).toBe(false);
    expect(isSavable(undefined)).toBe(false);
  });
});
