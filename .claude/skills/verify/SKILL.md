---
name: verify
description: Start SchnellBuch locally and check a change end to end in a browser with agent-browser, including the MCP endpoint. Use after any meaningful change to the web app or the Convex backend.
---

# Verify SchnellBuch

## Start

1. `bun install` in a fresh worktree.
2. `bun run dev:verify`. It starts this worktree's own stack and returns once everything answers (about a minute the first time, seconds after):
   - a Convex local backend on ports derived from the worktree path (20000-29999), so parallel worktrees never collide;
   - the Convex functions pushed to it, with `SIGNUP_ALLOWED_EMAILS=@schnellbuch.test` and the other backend settings;
   - the web app;
   - two seeded accounts, `ada@schnellbuch.test` and `bob@schnellbuch.test`, each with nested folders and bookmarks, signed up through the app's own `/api/auth` routes.
3. It prints the app URL, each account's password, user ID and MCP API key. The same values are in `~/.cache/schnellbuch/dev-verify/<stack>/env.sh` (outside the repo): `source` it for `$SCHNELLBUCH_WEB_URL`, `$SCHNELLBUCH_MCP_URL`, `$ADA_MCP_KEY`, `$BOB_PASSWORD` and so on. After sourcing it, `bunx convex data|run|logs` in `packages/backend` reach this stack instead of the cloud dev deployment.
4. Re-running reuses the data. `bun run dev:verify reseed` starts from empty with fresh accounts; `status` says what's running.

The first run downloads the Convex local backend from GitHub (`version.convex.dev` and `github.com` must be reachable). Logs are in `backend.log` and `web.log` next to `env.sh`.

## Log in

Use a named agent-browser session. Sign in on `/sign-in` as Ada or Bob with the printed password. Ada has `Dev / Convex`, `Dev / Tools`, `Reading` (with one page saved twice under different URLs) and two top-level bookmarks; Bob has `Recipes` and `Travel / Japan`. Use Bob to prove Ada's data never shows up. To test sign-up, any `@schnellbuch.test` address works; others see "Sign-ups are closed".

## What to check

- The top level shows folders, then bookmarks, as a grid. Click selects, double-click (or ↵) opens, ⌘↑ goes up, Back/Forward in the toolbar follow history.
- Paste a link into ⌘K → "Save …", or dispatch a `paste` event on the page with a link: it saves into the open folder and the title arrives within a few seconds.
- Right-click a tile for Open / Edit / Move to / Copy link / Delete. ⌘⌫ deletes the selection; the toast's Undo restores a bookmark.
- Drag a tile onto a folder tile, or onto a crumb in the path bar to move it up. Use `agent-browser mouse down/move/up` with `--steps`; `agent-browser drag` is too fast for dnd-kit.
- Bookmarklet: open `/add?url=<encoded>&title=<encoded>` at 420×320.
- Import and export: ⋯ → Export bookmarks downloads `schnellbuch-YYYY-MM-DD.html`; ⋯ → Import bookmarks… with a browser export (fixtures in `packages/backend/testing/fixtures`) shows progress in Settings and lands in one "Imported from …" folder.
- Settings → Recent agent changes lists bulk changes an agent made, each with Undo.
- Phone width: `agent-browser set device "iPhone 14"`; a tap opens a tile.

## Offline and install

The service worker only exists in a production build, and the server must run on the stack's web port, because Better Auth trusts only that origin:

1. `source <stack>/env.sh && bun run --cwd apps/web build`.
2. Stop the stack's Vite server (its PID is `pids.web` in `state.json`), then `PORT=<web port> node apps/web/.output/server/index.mjs`. Afterwards, stop it and run `bun run dev:verify` again to bring Vite back.
3. In Playwright (`chromium.launch()`), sign in as Ada and wait for `navigator.serviceWorker.ready`, then reload once so the worker caches the page. Wait a second for the mirror write.
4. Check:
   - `Page.getInstallabilityErrors` over CDP returns `[]`.
   - `ctx.setOffline(true)`: the banner says "You're offline", New (+) is disabled, and a pasted link gets the offline toast.
   - Reload while offline: the grid comes back from the mirror, with "Showing your bookmarks as of …". Open a folder, and ⌘K finds bookmarks.
   - Add a bookmark over MCP while the page is offline, then `ctx.setOffline(false)`: it appears with no navigation.
   - Sign out: the `schnellbuch` IndexedDB entry, the `schnellbuch-pages` cache and `localStorage["schnellbuch:last-user"]` are gone.

## Browser extension

1. Build it for this stack: `source <stack>/env.sh && WXT_SCHNELLBUCH_URL=$SCHNELLBUCH_WEB_URL bunx --cwd apps/extension wxt build -b chrome`.
2. Load `apps/extension/.output/chrome-mv3` in Playwright's Chromium: `chromium.launchPersistentContext("", { channel: "chromium", args: ["--disable-extensions-except=<dir>", "--load-extension=<dir>"] })`. Headless works.
3. Toolbar clicks, shortcuts and context menus are browser UI that automation can't press, so fire the extension's own listeners from its service worker with the arguments Chrome passes (`ctx.serviceWorkers()[0].evaluate(...)`):
   - toolbar: `chrome.action.onClicked.dispatch({ id: 1, url, title })`
   - shortcut: `chrome.commands.onCommand.dispatch("save-page", { id: 1, url, title })`
   - link menu: `chrome.contextMenus.onClicked.dispatch({ menuItemId: "save-link", linkUrl, pageUrl, editable: false }, tab)`
4. Each opens the `/add` popup in a new page. Signed out, it goes through `/sign-in` (wait for `networkidle` before typing) and then saves the original page. Pick a folder; the next save preselects it. A `chrome://` page sets the badge to "×" instead. The options page is `chrome-extension://<id>/options.html`.

## MCP endpoint

The server is `$SCHNELLBUCH_MCP_URL`. Keep keys and tokens out of logs.

- **API key:** `$ADA_MCP_KEY` and `$BOB_MCP_KEY` from `env.sh`, or Settings → "Create API key", or (after sourcing `env.sh`) `cd packages/backend && bunx convex run mcp:createApiKeyForUser '{"userId":"'$ADA_USER_ID'","name":"verify"}'`. Send JSON-RPC (`tools/list`, `tools/call`) with `Authorization: Bearer <key>`, `content-type: application/json`, `accept: application/json, text/event-stream`, `mcp-protocol-version: 2025-06-18`. For a real client: `claude -p "<task>" --strict-mcp-config --mcp-config <file> --allowedTools="mcp__schnellbuch__*"`.
- **OAuth (what Claude and ChatGPT connectors do):** register a client at `/mcp/oauth/register`, open `/mcp/oauth/authorize` with PKCE in the signed-in browser session, approve on `/connect`, catch the redirect with a one-shot local listener, then exchange the code at `/mcp/oauth/token`.
- **Device code:** `POST /mcp/oauth/device` with `client_id=mcp-agent`, open `verification_uri_complete`, tick the code-match box, Allow, then poll `/mcp/oauth/token`.
- Cross-user: Bob's key must get "Folder not found." / "Bookmark not found." for Ada's IDs, including in the bulk tools (`move_items`, `delete_bookmarks`, `undo_change`).

## Stop

`agent-browser close`, then `bun run dev:verify down` (data is kept for next time).
