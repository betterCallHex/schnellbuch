import { describe, expect, test as it } from "bun:test";
import { contentSecurityPolicy } from "./security-headers";

describe("contentSecurityPolicy", () => {
  it("lets the page reach its Convex deployment, over HTTP and WebSocket", () => {
    const policy = contentSecurityPolicy(
      "https://happy-otter-123.convex.cloud",
      "https://happy-otter-123.convex.site"
    );

    expect(policy).toContain(
      "connect-src 'self' https://happy-otter-123.convex.cloud wss://happy-otter-123.convex.cloud https://happy-otter-123.convex.site"
    );
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it("works with a local backend on plain HTTP", () => {
    expect(
      contentSecurityPolicy("http://127.0.0.1:3210/", "http://127.0.0.1:3211")
    ).toContain(
      "connect-src 'self' http://127.0.0.1:3210 ws://127.0.0.1:3210 http://127.0.0.1:3211"
    );
  });
});
