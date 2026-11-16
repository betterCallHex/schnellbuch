import { describe, expect, test as it } from "bun:test";
import { isServerPage, serverMatchPattern } from "./server-access";

describe("serverMatchPattern", () => {
  it("covers every page of the SchnellBuch host, whatever the port", () => {
    expect(serverMatchPattern("http://localhost:3000")).toBe(
      "http://localhost/*"
    );
    expect(serverMatchPattern("https://bookmarks.example.com/app")).toBe(
      "https://bookmarks.example.com/*"
    );
  });
});

describe("isServerPage", () => {
  it("is true only for pages on the exact SchnellBuch origin", () => {
    const server = "https://bookmarks.example.com";
    expect(isServerPage("https://bookmarks.example.com/settings", server)).toBe(
      true
    );
    expect(isServerPage("http://bookmarks.example.com/", server)).toBe(false);
    expect(isServerPage("https://bookmarks.example.com:8443/", server)).toBe(
      false
    );
    expect(isServerPage("https://evil.example.com/", server)).toBe(false);
    expect(isServerPage(undefined, server)).toBe(false);
  });
});
