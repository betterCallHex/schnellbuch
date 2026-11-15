import { describe, expect, test as it } from "vitest";
import { parsePageMetadata } from "./page";

describe("parsePageMetadata", () => {
  it("reads the title and resolves a relative icon", () => {
    const html = `<html><head>
      <title>  Bun &amp; friends
      </title>
      <link rel="shortcut icon" href="/static/icon.png">
    </head></html>`;

    expect(parsePageMetadata(html, "https://bun.sh/docs")).toEqual({
      title: "Bun & friends",
      faviconUrl: "https://bun.sh/static/icon.png",
    });
  });

  it("falls back to the Open Graph title and the site's favicon.ico", () => {
    const html = `<meta property='og:title' content='It&#39;s here'>`;

    expect(parsePageMetadata(html, "https://example.com/post")).toEqual({
      title: "It's here",
      faviconUrl: "https://example.com/favicon.ico",
    });
  });
});
