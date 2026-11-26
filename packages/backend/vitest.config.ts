import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    env: {
      SITE_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
      MCP_CONSENT_URL: "http://localhost:3000/connect",
      CONVEX_SITE_URL: "https://schnellbuch.convex.site",
    },
    server: { deps: { inline: ["convex-test"] } },
  },
});
