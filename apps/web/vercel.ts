import type { VercelConfig } from "@vercel/config/v1";
import { routes } from "@vercel/config/v1";

// The Vercel project's root directory is apps/web.
export default {
  framework: "tanstack-start",
  installCommand: "cd ../.. && bun install --frozen-lockfile",
  buildCommand: "bun scripts/vercel-build.ts",
  headers: [
    // The agent-approval page must never be framed (clickjacking). The
    // route sends the same CSP itself; this covers every response.
    routes.header("/connect", [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
    ]),
    // Browsers check for a new service worker on every visit.
    routes.header("/service-worker.js", [
      { key: "Cache-Control", value: "no-cache" },
    ]),
  ],
} satisfies VercelConfig;
