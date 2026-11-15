import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    env: {
      SITE_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
    },
    server: { deps: { inline: ["convex-test"] } },
  },
});
