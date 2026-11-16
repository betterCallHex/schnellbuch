# SchnellBuch

A fast, open-source bookmark manager: nested folders, ⌘K search, a bookmarklet that works in every browser, and an MCP server so agents can read and organise bookmarks.

## Done means

All of these pass before work counts as done:

- `bun run check:fix` then `bun run check` (Biome + Ultracite)
- `bun run typecheck`
- `bun run test`
- `bun run fallow` (dead code, unused exports, import cycles)
- For UI changes, run the `verify` skill (`.claude/skills/verify/SKILL.md`) and look at the result in a browser.

## Never without asking

- Deploy to production (`bun run --cwd packages/backend deploy`, Vercel production).
- Change or delete data on a Convex production deployment.
- Rotate `BETTER_AUTH_SECRET` (it signs every session).

## Layout

- `packages/backend`: the Convex backend. `convex/model/*` holds the logic as plain functions taking `(ctx, args)`. `convex/folders.ts` and `convex/bookmarks.ts` expose it to the signed-in user; `convex/agent.ts` exposes the same functions as internal functions for agents, checking every ID the model sends. `convex/mcp.ts` is the MCP server, built on `@convex-dev/mcp` (OAuth sign-in, API keys, scopes), served at `<CONVEX_SITE_URL>/mcp`.
- `apps/web/src/routes/connect.tsx` is the page where users approve an agent. Keep it unframeable and keep the device-code check.
- `packages/dev-stack`: `bun run dev:verify`, the per-worktree local stack.
- `apps/web`: TanStack Start app. Routes in `src/routes`, the authenticated shell is `src/routes/_app.tsx`.
- `apps/extension`: the WXT browser extension (React through `@wxt-dev/module-react`, Tailwind and shadcn/ui like the web app, Vite plugins in `wxt.config.ts`). It opens the web app's `/add` popup, and a content script registered at runtime for the configured SchnellBuch origin (`src/entrypoints/bridge.content.ts`) hands the browser's bookmarks to the web app's import dialog over `window.postMessage`. Keep it free of auth and backend calls; the web app does the import.
- One env file: `.env.local` at the repo root, nothing per package. Every env var, new or existing, is declared in a t3-env `createEnv` schema and read from its result, in app code, scripts and config files alike, including Vite's built-ins (`env.PROD`). Never read `process.env.X`, `import.meta.env.X` or `Bun.env.X` directly; the Biome plugin `biome-plugins/no-direct-env.grit` fails `bun run check` on it. The schemas: `apps/web/src/env.ts`, `packages/backend/convex/env.ts` (shared fields in `convex/model/env.ts`), `apps/extension/src/lib/env.ts`, the `createEnv` in `apps/web/vite.config.ts`, and one per script (`apps/web/scripts/vercel-build.ts`, `packages/backend/scripts/dev-setup.ts`, `packages/dev-stack/src/smoke.ts`, `packages/dev-stack/src/stack.ts`). Add every new variable to its schema and to `.env.example`. Backend variables reach the Convex dev deployment through `packages/backend/scripts/dev-setup.ts`, which `bun run dev` runs first.

## Words

- **Top level**: where folders and bookmarks without a parent folder live, shown as "Bookmarks" in the path bar.
- **Connected agent**: an MCP client the user approved on `/connect` (OAuth or device code), or an API key made in Settings for CLI agents. Listed and disconnected in Settings.

## Verifying

`bun run dev:verify` gives this worktree its own local Convex backend and web app, on ports derived from the worktree, seeded with two accounts (Ada and Bob) and printing their passwords and MCP keys. `down` stops it, `reseed` starts fresh. Parallel worktrees each get their own; nothing touches the shared dev deployment. The `verify` skill has the details.

## Working with Convex

`packages/dev-stack` holds the `dev:verify` script. From the repo root (root `convex.json`), the Convex CLI reaches the dev deployment, or this worktree's local stack after `source ~/.cache/schnellbuch/dev-verify/<stack>/env.sh`: `bunx convex data <table>`, `bunx convex run <module>:<function> '<json args>'`, `bunx convex logs`, `bunx convex env list|get|set`. MCP clients can use the same through `.mcp.json` (`convex mcp start`, dev deployment only). Mint an MCP key for a test user with `bunx convex run mcp:createApiKeyForUser '{"userId":"<Better Auth user id>","name":"test"}'`.

## Testing

- Convex functions: `convex-test` + Vitest in `packages/backend/convex/*.test.ts`, created with `testing/convex.ts`.
- Everything else: `bun test` next to the module (`*.test.ts`).
- Test pure logic and backend behaviour. No component render tests, no Playwright; the `verify` skill covers the UI.

## Style

- Biome + Ultracite rules apply, with one exception: `performance/noJsxPropsBind` is off because React Compiler memoizes inline handlers.
- UI components come from shadcn/ui on Base UI (`apps/web/src/components/ui`, generated, not linted).
