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
