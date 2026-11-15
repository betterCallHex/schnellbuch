# SchnellBuch

Fast, open-source bookmarks that work in every browser, and that your AI agents can manage for you.

- **Finder-style browsing**: folders and bookmarks as icons, a path bar, back and forward. Click to select, double-click or ↵ to open, ⌘↑ to go up, right-click for actions, ⌘⌫ to delete (with Undo).
- **Drag and drop** onto folders, or onto the path bar to move things up.
- **⌘V** with a link copied saves it into the folder you're looking at.
- **⌘K** searches every bookmark and folder as you type (fuzzy: `cnvx hub` finds "Convex Developer Hub"). Paste a link into it to save it.
- **Bookmarklet** saves the page you're on from any browser, no extension needed.
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
```

Open http://localhost:3000 and create an account.

## Connect an agent

Settings → Agent access shows your MCP server URL (`<your Convex site URL>/mcp`).

- **Claude, ChatGPT, Cursor:** paste the URL as a connector or MCP server. You're sent to SchnellBuch to approve it, with a choice between read-only and read/write access.
- **Claude Code and other CLIs:** create an API key in Settings and run the `claude mcp add …` command it shows.
- **Any agent that can make HTTP requests:** give it the URL. It reads the instructions there and shows you a sign-in link with a code to confirm.

Disconnect any agent in Settings. Built on [`@convex-dev/mcp`](https://www.convex.dev/components/mcp).

Tools: `list_folders`, `list_bookmarks`, `search_bookmarks`, `add_bookmark`, `update_bookmark`, `delete_bookmark`, `create_folder`, `update_folder`, `delete_folder`.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Convex dev deployment + web app on :3000 |
| `bun run check` / `check:fix` | Biome + Ultracite |
| `bun run typecheck` | TypeScript in every package |
| `bun run test` | Vitest (`convex-test`) and `bun test` |
| `bun run fallow` | Dead code, unused exports, import cycles |

## Choices that differ from the usual defaults

- **Agent sign-in** uses `@convex-dev/mcp` (alpha) instead of Better Auth's API key plugin, which would need the Better Auth component's "local install" on Convex.
- **No Convex backups, Axiom or PostHog**: not needed for a personal app. Export (planned) will double as a backup.
- **Biome `noJsxPropsBind` is off**: React Compiler already memoizes inline handlers.

## License

MIT
