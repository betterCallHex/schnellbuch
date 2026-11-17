# SchnellBuch

Fast, open-source bookmarks that work in every browser, and that your AI agents can manage for you.

- **Finder-style browsing**: folders and bookmarks as icons or as a list, sorted by date saved or by name, a path bar, back and forward. Click to select, ⌘-click or ⇧-click to select several, ⌘A for all, double-click or ↵ to open, ⌘↑ to go up, right-click for actions, ⌘⌫ to delete (with Undo). Folders with thousands of bookmarks stay fast.
- **Drag and drop** onto folders, or onto the path bar to move things up. Dragging one of several selected items moves them all, as one Undo.
- **⌘V** with a link copied saves it into the folder you're looking at. A link you already have isn't saved twice: SchnellBuch says where it is, with a button to show it.
- **⌘K** searches every bookmark (title, link and note) and folder as you type (fuzzy: `cnvx hub` finds "Convex Developer Hub", `dv cnvx` the folder "Dev / Convex"). ⌘↵ shows the highlighted bookmark in its folder. Paste a link into it to save it.
- **Notes** on bookmarks, for why you saved something. They're searched, shown in the list view, kept in exports (as browsers' `<DD>` descriptions) and readable and writable by agents.
- **Library health**: check whether saved pages still exist, and find the same page saved under different links. Delete what's broken or duplicated in one go, with Undo.
- **Browser extension** for Chrome, Firefox and Edge (and other Chromium browsers): the toolbar button or Alt+Shift+S saves the current tab, and right-clicking a link saves it. The save popup remembers the folder you used last. It also hands the browser's bookmarks to SchnellBuch for a one-click import.
- **Bookmarklet** saves the page you're on from any browser, no extension needed.
- **Import and export**: pick the browser your bookmarks are in. With the extension installed in that browser they import in one click; otherwise SchnellBuch shows that browser's export steps and takes the exported file (Safari always goes this way). Folders, titles and dates are kept and links you already have are skipped. Export downloads your whole library as a bookmarks file, as a backup.
- **MCP server** so Claude, Cursor or any MCP client can list, search, add, move and delete your bookmarks.
- Live everywhere: a change from an agent or another tab shows up immediately.
- **Installable, and works offline**: install it from the browser (or "Add to Home Screen") and it opens in its own window. Without a network you can still browse and search (⌘K) the library you last loaded, and add, edit, move, copy and delete bookmarks and folders. Those changes are kept on the device (IndexedDB), marked "Waiting to sync", and sent in order once you're back online, even after a reload. Signing out removes the copy and any unsynced changes from the device.
- **Finder-style Edit menu**: the toolbar's Edit menu names what ⌘Z and ⇧⌘Z would undo or redo ("Undo Move “Docs”"), and cuts, copies and pastes the selected items.
- **No passwords**: sign in, or create an account, with a 6-digit code sent to your email (through Mailtrap). Deleting your account, which removes your bookmarks, history and agent connections, is confirmed with a code too.

## Stack

TypeScript, Bun workspaces, Turborepo, Convex (database, functions, realtime) with the Workpool and Rate Limiter components, Better Auth (`@convex-dev/better-auth`), TanStack Start with React Compiler, TanStack Virtual, Tailwind + shadcn/ui on Base UI, cmdk, uFuzzy, dnd-kit, t3-env, Biome + Ultracite, fallow, Vitest with `convex-test` for the backend and `bun test` for the rest.

## Run it

```sh
bun install
bun run dev
```

The first run creates `.env.local` at the repo root from `.env.example`, generates `BETTER_AUTH_SECRET`, and asks you to log in to Convex and create a project; Convex writes the deployment and its URLs into the same file. Put your address in `SIGNUP_ALLOWED_EMAILS` there, run `bun run dev` again, then open http://localhost:3000 and sign in with your email. Until Mailtrap is set up (below), the sign-in code is written to the Convex logs (`bunx convex logs`) instead of emailed.

### Environment variables

There is one env file: `.env.local` at the repo root. Every app and package reads it, and there are no per-package env files. `.env.example` lists every variable.

- The web app and the extension load it through Vite's `envDir`.
- The Convex CLI runs from the repo root (`convex.json` points it at `packages/backend/convex`), so `bunx convex …` from the root reaches your dev deployment.
- Convex functions can't read local files, so `bun run dev` pushes the backend settings (`BETTER_AUTH_SECRET`, `SITE_URL`, `MCP_CONSENT_URL`, `SIGNUP_ALLOWED_EMAILS`, `MAILTRAP_API_TOKEN`, `EMAIL_FROM`) from `.env.local` to your **dev** deployment before each start. Edit them in the file, never with `convex env set`. Production settings stay on the production deployment (see Deploy).

### Who can sign up

Only addresses in `SIGNUP_ALLOWED_EMAILS` can create an account. It's a comma-separated list of addresses (`me@example.com`) or whole domains (`@family.example`), compared case-insensitively. Anyone else gets no sign-in code. An empty or missing list closes sign-ups entirely, and accounts that already exist keep signing in whatever the list says.

### Sign-in codes by email (Mailtrap)

There are no passwords. Signing in sends a 6-digit code to the address. It works once, for 5 minutes, and three wrong guesses use it up. Each address can ask for a code or try one ten times every 15 minutes. Codes go only to existing accounts and to addresses that `SIGNUP_ALLOWED_EMAILS` lets in, so nobody can spend your email quota on strangers. The first time an account from the password days signs in with a code, its old password and sessions are removed; its library stays.

Email goes out through [Mailtrap](https://mailtrap.io)'s Email API. The free plan covers 4,000 emails a month, 150 a day:

1. Sign up, open **Sending Domains**, add your domain and add the DNS records it shows (in Cloudflare: DNS only). Wait for it to say verified.
2. Under **API Tokens**, create a token with access to that domain.
3. Set `MAILTRAP_API_TOKEN` to the token and `EMAIL_FROM` to an address at that domain (`login@bookmarks.example.com`): in `.env.local` for dev, with `bunx convex env set --prod` for production.

Without both settings, nothing is emailed and the code is written to the Convex logs instead. Whoever runs the deployment can always issue a code without email (add `--prod` for production). It replaces any code already sent:

```sh
bunx convex run account:signInCode '{"email":"me@example.com"}'
```

## Deploy (Vercel + Convex)

The website runs on Vercel and the backend on a Convex production deployment. Every merge to `main` ships both from the same commit: Vercel's build runs `convex deploy`, which pushes the functions and then builds the site against that deployment.

One-time setup:

1. **Convex:** create a production deployment and set its settings (from the repo root, with `--prod`):
   ```sh
   bunx convex env set --prod BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   bunx convex env set --prod SITE_URL https://bookmarks.example.com
   bunx convex env set --prod MCP_CONSENT_URL https://bookmarks.example.com/connect
   bunx convex env set --prod SIGNUP_ALLOWED_EMAILS you@example.com
   bunx convex env set --prod MAILTRAP_API_TOKEN <token>
   bunx convex env set --prod EMAIL_FROM login@bookmarks.example.com
   ```
   Then create a **production deploy key** in the Convex dashboard (Settings → Deploy keys).
2. **Vercel:** import the repository with **Root Directory `apps/web`**. `apps/web/vercel.ts` sets the install and build commands and the `/connect` anti-framing headers. Add environment variables:
   - Production: `CONVEX_DEPLOY_KEY` (the production key) and `VITE_SITE_URL` (your domain).
   - Preview: either a Convex **preview deploy key** as `CONVEX_DEPLOY_KEY` (paid Convex plans; each PR gets its own backend), or `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` of your dev deployment, so previews show the site against dev data.
3. **Domain (Cloudflare):** add the domain in Vercel, then in Cloudflare DNS create the record Vercel asks for (a `CNAME` to `cname.vercel-dns.com`, or an `A` record for the apex) with the proxy **off** (DNS only), so Vercel issues the HTTPS certificate.
4. After the first deploy, run the smoke check:
   ```sh
   SMOKE_SITE_URL=https://bookmarks.example.com \
   SMOKE_MCP_URL=https://<deployment>.convex.site/mcp \
   bun run smoke
   ```
   Add `SMOKE_MCP_KEY` (an API key from Settings) to check that MCP lists its tools.

Existing deployments from before saved dates existed: run `bunx convex run migrations:backfillSavedAt` (with `--prod` for production) once. It's safe to run again.

## Browser extension

`apps/extension` (WXT) builds Chrome, Firefox and Edge versions into `apps/extension/.output/`:

```sh
WXT_SCHNELLBUCH_URL=https://your-schnellbuch.example bun run --cwd apps/extension build
```

Load `.output/chrome-mv3` (or `edge-mv3`) as an unpacked extension, or `.output/firefox-mv2` as a temporary add-on in Firefox. `WXT_SCHNELLBUCH_URL` is the default address; anyone can change it on the extension's options page. Every way of saving opens SchnellBuch's `/add` popup, so sign-in and folders work exactly as they do with the bookmarklet.

To import this browser's bookmarks, open SchnellBuch in it, choose ⋯ → Import bookmarks… and pick the browser. The extension reads the bookmarks (the `bookmarks` permission) and passes them only to the SchnellBuch address on its options page; the web app imports them as one new folder. The default address's host is allowed at install; saving another address on the options page asks for access to that host. Reload SchnellBuch's tab after installing the extension or changing the address.

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
| `list_changes`: recent changes with their IDs | `check_links`: check in the background whether pages still exist |
| | `create_folder`, `update_folder`, `delete_folder` |

SchnellBuch never opens a link an agent sends (no title fetch, no link check), so text an agent read can't make the server send data anywhere. Agents should pass the page title.

Every write an agent makes is one change set, from `add_bookmark` to `delete_folder`, and returns its `changeId`. Agents can reverse it with `undo_change`, and you can see and undo it in Settings → Recent agent changes. `add_bookmarks`, `move_items` and `delete_bookmarks` make one change set of many items. Changes are kept for 90 days.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Convex dev deployment + web app on :3000 |
| `bun run dev:verify` | This worktree's own local backend + web app, seeded with two accounts; `down`, `reseed`, `status`, `code <email>` |
| `bun run check` / `check:fix` | Biome + Ultracite |
| `bun run typecheck` | TypeScript in every package |
| `bun run test` | Vitest (`convex-test`) and `bun test` |
| `bun run fallow` | Dead code, unused exports, import cycles |

## Choices that differ from the usual defaults

- **Agent sign-in** uses `@convex-dev/mcp` (alpha) instead of Better Auth's API key plugin, which would need the Better Auth component's "local install" on Convex.
- **No Convex backups, Axiom or PostHog**: not needed for a personal app. Export doubles as a backup.
- **Page fetches are fenced and batched**: titles, icons and link checks only ever request public web addresses, each redirect checked again, and read at most 500 KB of a page. An import fetches one page per site when only the icon is missing, a few batches at a time through a Convex Workpool, and writes each batch's results at once, so open tabs get one update per batch rather than one per bookmark.
- **Content-Security-Policy on every page**: the browser extension hands the browser's bookmarks to any script on SchnellBuch's origin, so scripts, connections and framing are locked to SchnellBuch and its Convex deployment.
- **Biome `noJsxPropsBind` is off**: React Compiler already memoizes inline handlers.

## License

MIT
