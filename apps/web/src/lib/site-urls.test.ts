import { describe, expect, test as it } from "bun:test";
import { convexSiteUrl, siteUrl } from "./site-urls";

describe("convexSiteUrl", () => {
  it("a cloud deployment's HTTP actions are on .convex.site", () => {
    expect(convexSiteUrl("https://happy-otter-123.convex.cloud")).toBe(
      "https://happy-otter-123.convex.site"
    );
  });

  it("an explicit URL (custom domain, local backend) wins", () => {
    expect(
      convexSiteUrl("http://127.0.0.1:3210", "http://127.0.0.1:3211")
    ).toBe("http://127.0.0.1:3211");
  });

  it("anything else has to be set explicitly", () => {
    expect(() => convexSiteUrl("http://127.0.0.1:3210")).toThrow(
      "Set VITE_CONVEX_SITE_URL"
    );
  });
});

describe("siteUrl", () => {
  it("production uses the project's domain, previews their own URL", () => {
    const vercel = {
      port: 3000,
      vercelProductionHost: "bookmarks.example.com",
      vercelHost: "schnellbuch-abc123.vercel.app",
    };
    expect(siteUrl({ ...vercel, vercelEnv: "production" })).toBe(
      "https://bookmarks.example.com"
    );
    expect(siteUrl({ ...vercel, vercelEnv: "preview" })).toBe(
      "https://schnellbuch-abc123.vercel.app"
    );
  });

  it("locally it's localhost, unless set", () => {
    expect(siteUrl({ port: 3001 })).toBe("http://localhost:3001");
    expect(siteUrl({ port: 3001, explicit: "https://x.dev" })).toBe(
      "https://x.dev"
    );
  });
});
