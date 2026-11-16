# SchnellBuch

Fast, open-source bookmarks that work in every browser, and that your AI agents can manage for you.

- **Finder-style browsing**: folders and bookmarks as icons, a path bar, back and forward. Click to select, double-click or ↵ to open, ⌘↑ to go up, right-click for actions, ⌘⌫ to delete (with Undo).
- **Drag and drop** onto folders, or onto the path bar to move things up.
- **⌘V** with a link copied saves it into the folder you're looking at.
- **⌘K** searches every bookmark and folder as you type (fuzzy: `cnvx hub` finds "Convex Developer Hub"). Paste a link into it to save it.
- **Browser extension** for Chrome, Firefox and Edge: the toolbar button or Alt+Shift+S saves the current tab, and right-clicking a link saves it. The save popup remembers the folder you used last.
- **Bookmarklet** saves the page you're on from any browser, no extension needed.
- **Import and export**: bring in the bookmarks file Chrome, Firefox, Safari or Edge exports (folders, titles and dates kept, links you already have skipped), and download your whole library in the same format as a backup.
- **MCP server** so Claude, Cursor or any MCP client can list, search, add, move and delete your bookmarks.
- Live everywhere: a change from an agent or another tab shows up immediately.
- **Installable, and readable offline**: install it from the browser (or "Add to Home Screen") and it opens in its own window. Without a network you can still browse and search (⌘K) the library you last loaded; saving, moving and deleting pause until you're back. Signing out removes that copy from the device.

## Stack

TypeScript, Bun workspaces, Turborepo, Convex (database, functions, realtime), Better Auth (`@convex-dev/better-auth`), TanStack Start with React Compiler, Tailwind + shadcn/ui on Base UI, cmdk, uFuzzy, dnd-kit, t3-env, Biome + Ultracite, fallow, Vitest with `convex-test` for the backend and `bun test` for the rest.

## Run it

```sh
bun install
bun run dev
```

The first run of `convex dev` asks you to log in to Convex and create a project. Then set the backend secrets once:

```sh
cd packages/backend
bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set SITE_URL http://localhost:3000
bunx convex env set MCP_CONSENT_URL http://localhost:3000/connect
bunx convex env set SIGNUP_ALLOWED_EMAILS you@example.com
```

Open http://localhost:3000 and create an account.

### Who can sign up

Only addresses in `SIGNUP_ALLOWED_EMAILS` can create an account. It's a comma-separated list of addresses (`me@example.com`) or whole domains (`@family.example`), compared case-insensitively. Anyone else sees "Sign-ups are closed". An empty or missing list closes sign-ups entirely, and accounts that already exist keep signing in whatever the list says.

## Deploy (Vercel + Convex)

The website runs on Vercel and the backend on a Convex production deployment. Every merge to `main` ships both from the same commit: Vercel's build runs `convex deploy`, which pushes the functions and then builds the site against that deployment.

One-time setup:

1. **Convex:** create a production deployment and set its settings (from `packages/backend`, with `--prod`):
   ```sh
   bunx convex env set --prod BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   bunx convex env set --prod SITE_URL https://bookmarks.example.com
   bunx convex env set --prod MCP_CONSENT_URL https://bookmarks.example.com/connect
   bunx convex env set --prod SIGNUP_ALLOWED_EMAILS you@example.com
   ```
   Then create a **production deploy key** in the Convex dashboard (Settings → Deploy keys).
2. **Vercel:** import the repository with **Root Directory `apps/web`**. `apps/web/vercel.ts` sets the install and build commands and the `/connect` anti-framing headers. Add environment variables:
   - Production: `CONVEX_DEPLOY_KEY` (the production key) and `VITE_SITE_URL` (your domain).
   - Preview: either a Convex **preview deploy key** as `CONVEX_DEPLOY_KEY` (paid Convex plans; each PR gets its own backend), or `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` of your dev deployment, so previews show the site against dev data.
3. **Domain (Cloudflare):** add the domain in Vercel, then in Cloudflare DNS create the record Vercel asks for (a `CNAME` to `cname.vercel-dns.com`, or an `A` record for the apex) with the proxy **off** (DNS only), so Vercel issues the HTTPS certificate.
4. After the first deploy, run the smoke check:
   ```sh
   SMOKE_SITE_URL=https://bookmarks.example.com \
   SMOKE_CONVEX_URL=https://<deployment>.convex.cloud \
   SMOKE_MCP_URL=https://<deployment>.convex.site/mcp \
   bun run smoke
   ```
   Add `SMOKE_MCP_KEY` (an API key from Settings) and `SMOKE_EMAIL`/`SMOKE_PASSWORD` for the signed-in checks.

Existing deployments from before saved dates existed: run `bunx convex run migrations:backfillSavedAt` (with `--prod` for production) once. It's safe to run again.

## Browser extension

`apps/extension` (WXT) builds Chrome, Firefox and Edge versions into `apps/extension/.output/`:

```sh
WXT_SCHNELLBUCH_URL=https://your-schnellbuch.example bun run --cwd apps/extension build
```

Load `.output/chrome-mv3` (or `edge-mv3`) as an unpacked extension, or `.output/firefox-mv2` as a temporary add-on in Firefox. `WXT_SCHNELLBUCH_URL` is the default address; anyone can change it on the extension's options page. Every way of saving opens SchnellBuch's `/add` popup, so sign-in and folders work exactly as they do with the bookmarklet.

## Connect an agent

Settings → Agent access shows your MCP server URL (`<your Convex site URL>/mcp`).

- **Claude, ChatGPT, Cursor:** paste the URL as a connector or MCP server. You're sent to SchnellBuch to approve it, with a choice between read-only and read/write access.
- **Claude Code and other CLIs:** create an API key in Settings and run the `claude mcp add …` command it shows.
- **Any agent that can make HTTP requests:** give it the URL. It reads the instructions there and shows you a sign-in link with a code to confirm.

Disconnect any agent in Settings. Built on [`@convex-dev/mcp`](https://www.convex.dev/components/mcp).

Tools:

| Read (`bookmarks:read`) | Write (`bookmarks:write`) |
|---|---|
| `list_folders`: folders with path and bookmark count, filtered by `query`, paged | `add_bookmark`, `update_bookmark`, `delete_bookmark` |
| `list_bookmarks`: newest first, per folder, paged with `nextCursor` | `add_bookmarks`: up to 200 links at once, skipping ones already saved |
| `search_bookmarks`: fuzzy, optionally inside one folder | `move_items`: up to 200 bookmarks and folders in one call |
| `find_duplicates`: the same page saved under different URLs | `delete_bookmarks`: up to 200 at once |
| `find_broken_links`: results of the last `check_links` | `undo_change`: reverse one bulk change |
| `list_changes`: recent bulk changes with their IDs | `check_links`: check in the background whether pages still exist |
| | `create_folder`, `update_folder`, `delete_folder` |

SchnellBuch never opens a link an agent sends (no title fetch, no link check), so text an agent read can't make the server send data anywhere. Agents should pass the page title.

Every `add_bookmarks`, `move_items` and `delete_bookmarks` call is one change set. Agents can reverse it with `undo_change`, and you can undo it in Settings → Recent agent changes.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Convex dev deployment + web app on :3000 |
| `bun run dev:verify` | This worktree's own local backend + web app, seeded with two accounts; `down`, `reseed`, `status` |
| `bun run check` / `check:fix` | Biome + Ultracite |
| `bun run typecheck` | TypeScript in every package |
| `bun run test` | Vitest (`convex-test`) and `bun test` |
| `bun run fallow` | Dead code, unused exports, import cycles |

## Choices that differ from the usual defaults

- **Agent sign-in** uses `@convex-dev/mcp` (alpha) instead of Better Auth's API key plugin, which would need the Better Auth component's "local install" on Convex.
- **No Convex backups, Axiom or PostHog**: not needed for a personal app. Export doubles as a backup.
- **Biome `noJsxPropsBind` is off**: React Compiler already memoizes inline handlers.

## License

MIT
