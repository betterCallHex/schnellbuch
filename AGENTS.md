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

- `packages/backend`: the Convex backend. `convex/model/*` holds the logic as plain functions taking `(ctx, args)`; `convex/folders.ts` and `convex/bookmarks.ts` expose each operation twice, once for the signed-in user and once (`*ForAgent`, internal) for the MCP server, from the same handler and validators. `convex/mcp.ts` is the MCP endpoint, served at `<CONVEX_SITE_URL>/mcp`.
- `apps/web`: TanStack Start app. Routes in `src/routes`, the authenticated shell is `src/routes/_app.tsx`.
- Env vars are read only through t3-env: `apps/web/src/env.ts`, `packages/backend/convex/env.ts`, and the `createEnv` call in `apps/web/vite.config.ts`. Add new variables there and to `.env.example`.

## Words

- **Unsorted**: a bookmark with no folder.
- **Agent token**: a bearer token for the MCP endpoint, made in Settings. Only its SHA-256 hash is stored.

## Testing

- Convex functions: `convex-test` + Vitest in `packages/backend/convex/*.test.ts`, created with `testing/convex.ts`.
- Everything else: `bun test` next to the module (`*.test.ts`).
- Test pure logic and backend behaviour. No component render tests, no Playwright; the `verify` skill covers the UI.

## Style

- Biome + Ultracite rules apply, with one exception: `performance/noJsxPropsBind` is off because React Compiler memoizes inline handlers.
- UI components come from shadcn/ui on Base UI (`apps/web/src/components/ui`, generated, not linted).
