import type { VercelConfig } from "@vercel/config/v1";
import { routes } from "@vercel/config/v1";
// The Vercel project's root directory is apps/web. Vercel's build image
// ships an older Bun that can't read our bun.lock, so both commands run the
// Bun pinned in the root package.json's packageManager. Vercel only accepts
// literal strings here; bump these with it.
export default {
  framework: "tanstack-start",
  installCommand: "cd ../.. && npx --yes bun@1.4.3 install --frozen-lockfile",
  buildCommand: "npx --yes bun@1.4.3 scripts/vercel-build.ts",
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
