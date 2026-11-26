---
name: verify
description: Start SchnellBuch locally and check a change end to end in a browser with agent-browser, including the MCP endpoint. Use after any meaningful change to the web app or the Convex backend.
---

# Verify SchnellBuch

## Start

1. `bun install` in a fresh worktree.
2. `bun run dev:verify`. It starts this worktree's own stack and returns once everything answers (about a minute the first time, seconds after):
   - a Convex local backend on ports derived from the worktree path (20000-29999), so parallel worktrees never collide;
   - the Convex functions pushed to it, with the backend settings;
   - the web app;
   - two seeded accounts, `ada@schnellbuch.test` and `bob@schnellbuch.test`, each with nested folders and bookmarks, signed up through the app's own `/api/auth` routes.
3. It prints the app URL, each account's user ID and MCP API key. The same values are in `~/.cache/schnellbuch/dev-verify/<stack>/env.sh` (outside the repo): `source` it for `$SCHNELLBUCH_WEB_URL`, `$SCHNELLBUCH_MCP_URL`, `$ADA_MCP_KEY`, `$BOB_EMAIL` and so on. After sourcing it, `bunx convex data|run|logs` from the repo root reach this stack instead of the cloud dev deployment.
4. Re-running reuses the data. `bun run dev:verify reseed` starts from empty with fresh accounts; `status` says what's running.

The first run downloads the Convex local backend from GitHub (`version.convex.dev`, `github.com`, `objects.githubusercontent.com` and `release-assets.githubusercontent.com` must be reachable). Without `agent-browser`, Playwright (`require("playwright")`) drives the same checks. Logs are in `backend.log` and `web.log` next to `env.sh`.

## Log in

Use a named agent-browser session. On `/sign-in`, enter Ada's or Bob's address and press "Email me a code"; the stack sends no email, so run `bun run dev:verify code <email>` and type the code it prints (it replaces the one the page asked for). Ada has `Dev / Convex`, `Dev / Tools`, `Reading` (with one page saved twice under different URLs) and two top-level bookmarks; Bob has `Recipes` and `Travel / Japan`. Use Bob to prove Ada's data never shows up. To test sign-up, any new address works the same way: its first code creates the account.

## What to check

- The top level shows folders, then bookmarks, as a grid. Click selects, double-click (or ↵) opens, ⌘↑ goes up, Back/Forward in the toolbar follow history.
- Paste a link into ⌘K → "Save …", or dispatch a `paste` event on the page with a link: it saves into the open folder and the title arrives within a few seconds.
- Right-click a tile for Open / Edit / Move to / Cut / Copy / Delete, and Customize… on a folder (colour plus a symbol or emoji, shown in the grid, the path bar and ⌘K). ⌘⌫ deletes the selection; the toast's Undo restores it.
- The toolbar's Edit menu (the ↶ button) names the next undo and redo ("Undo Delete “MDN Web Docs”") and cuts, copies and pastes the selected tile.
- Shortcuts (TanStack Hotkeys; `agent-browser press Meta+z` and friends): ⌘Z / ⌘⇧Z undo and redo this tab's moves, renames, edits, deletes, adds, pastes and customizations. ⌘X dims the selected tile and ⌘C copies it, each with a toast; ⌘V in another folder moves or copies it there. Headless Chromium doesn't paste on ⌘V, so dispatch a `paste` event whose text is exactly what was copied (the bookmark's stored URL, or the folder's name). Shortcuts pause while a dialog is open.
- Drag a tile onto a folder tile, or onto a crumb in the path bar to move it up. Use `agent-browser mouse down/move/up` with `--steps`; `agent-browser drag` is too fast for dnd-kit.
- Bookmarklet: open `/add?url=<encoded>&title=<encoded>` at 420×320.
- Import and export: ⋯ → Export bookmarks downloads `schnellbuch-YYYY-MM-DD.html`; ⋯ → Import bookmarks… opens the browser picker; pick one without the extension and drop or choose a browser export (fixtures in `packages/backend/testing/fixtures`, `agent-browser upload 'input[type=file]' <file>`). It shows progress in Settings and lands in one "Imported from …" folder.
- Settings → Recent agent changes lists every change an agent made (single tools too), each with Undo.
- Selection: ⌘-click (Ctrl on Linux) and ⇧-click select several tiles, ⌘A all of them, and dragging a box from empty space selects every tile it touches as in Finder and Explorer (⇧-drag adds to the selection, ⌘-drag (Ctrl on Linux) flips the tiles it touches, holding the pointer just below the toolbar or at the window's bottom edge scrolls, Esc cancels the box and restores the selection, and wheel scrolling mid-drag keeps going; `agent-browser` can't hold modifiers, so drive ⇧ and ⌘ through Playwright over `agent-browser get cdp-url`); right-click one of them for "Move N items to / Cut / Copy / Delete N items"; ⌘⌫ deletes them all (a dialog first when folders are among them) and one ⌘Z brings them back. Dragging one selected tile moves the whole selection.
- View (the grid button in the toolbar, inside ⋯ on phones): Icons or List, sorted by date saved or name, remembered after a reload. For a big folder, `add_bookmarks` 3×200 links over MCP into one folder: only about a hundred tiles are in the page, arrow keys keep the selected tile focused and scrolled into view.
- Saving a link that's already saved (paste, ⌘K, the add dialog) toasts "Already saved in …" with Show; `/add` with such a link says "Already saved" and its folder picker moves the existing bookmark.
- ⌘K: `dv cnvx` finds the folder "Dev / Convex"; ⌘↵ (Ctrl+Enter on Linux) on a bookmark opens its folder with it selected (`?select=`).
- Edit… on a bookmark has a Note; the tile's tooltip, the list view, ⌘K and the MCP tools show it.
- Tags: Edit… takes comma-separated tags; a tagged tile gets a tag badge in Icons and chips in List, and ⌘K finds bookmarks by tag. Over MCP, `tag_bookmarks` adds and removes tags in bulk (one undoable change), `list_bookmarks` and `search_bookmarks` take `tags` and `withoutTags`, and `list_tags` counts them.
- ⋯ → Library health: "Check links" queues checks (results within seconds; in a sandbox without internet every link reads "Gone"), and Ada's `Reading` shows up under Duplicates.
- Settings → Account: Delete account… emails a code (`bun run dev:verify code <email>` again), then deletes and signs out; signing in again with that address makes a new, empty account.
- No `securitypolicyviolation` events in the console: every page sends a Content-Security-Policy.
- Phone width: `agent-browser set device "iPhone 14"`; a tap opens a tile.

## Offline edits in dev

Without a production build: `window.dispatchEvent(new Event("offline"))` puts the page offline, so edits queue in IndexedDB (`offline-queue` store); reloading brings it back online and the queue syncs from storage. For a real disconnect, kill the stack's backend (`pids.backend` in `state.json`), edit, then `bun run dev:verify` to restart it: the queue syncs without a reload.

## Offline and install

The service worker only exists in a production build, and the server must run on the stack's web port, because Better Auth trusts only that origin:

1. `source <stack>/env.sh && bun run --cwd apps/web build`.
2. Stop the stack's Vite server (its PID is `pids.web` in `state.json`), then `PORT=<web port> node apps/web/.output/server/index.mjs`. Afterwards, stop it and run `bun run dev:verify` again to bring Vite back.
3. In Playwright (`chromium.launch()`), sign in as Ada and wait for `navigator.serviceWorker.ready`, then reload once so the worker caches the page. Wait a second for the mirror write.
4. Check:
   - `Page.getInstallabilityErrors` over CDP returns `[]`.
   - `ctx.setOffline(true)`: the banner says "You're offline". Add a folder, paste a link into it, delete a bookmark: each shows at once, marked "Waiting to sync", and the banner counts them.
   - Reload while offline: the grid comes back from the mirror, with "Showing your bookmarks as of …". Open a folder, and ⌘K finds bookmarks.
   - Add a bookmark over MCP while the page is offline, then `ctx.setOffline(false)`: it appears with no navigation, and the queued changes sync in order ("Synced N changes made offline").
   - Sign out: with changes still waiting, a toast asks first. Then the `schnellbuch` IndexedDB entry (mirror, `offline-queue`, `synced-ids`), the `schnellbuch-pages` cache and `localStorage["schnellbuch:last-user"]` are gone.

## Browser extension

1. Build it for this stack: `source <stack>/env.sh && cd apps/extension && WXT_SCHNELLBUCH_URL=$SCHNELLBUCH_WEB_URL bunx wxt build -b chrome`.
2. Load `apps/extension/.output/chrome-mv3` in Playwright's Chromium: `chromium.launchPersistentContext("", { channel: "chromium", args: ["--disable-extensions-except=<dir>", "--load-extension=<dir>"] })`. Headless works.
3. Toolbar clicks, shortcuts and context menus are browser UI that automation can't press, so fire the extension's own listeners from its service worker with the arguments Chrome passes (`ctx.serviceWorkers()[0].evaluate(...)`):
   - toolbar: `chrome.action.onClicked.dispatch({ id: 1, url, title })`
   - shortcut: `chrome.commands.onCommand.dispatch("save-page", { id: 1, url, title })`
   - link menu: `chrome.contextMenus.onClicked.dispatch({ menuItemId: "save-link", linkUrl, pageUrl, editable: false }, tab)`
4. Each opens the `/add` popup in a new page. Signed out, it goes through `/sign-in` (wait for `networkidle` before typing) and then saves the original page. Pick a folder; the next save preselects it. A `chrome://` page sets the badge to "×" instead. The options page is `chrome-extension://<id>/options.html`.
5. Browser import: agent-browser loads it too (`agent-browser --session <name> --extension <dir> open <app>`). On the app, `postMessage({channel:"schnellbuch:page",type:"hello"}, location.origin)` gets a `schnellbuch:extension` `ready` reply. Add bookmarks with `chrome.bookmarks.create` from the options page (the unpacked ID is the first 32 hex of the directory path's SHA-256, mapped 0-f → a-p), then ⋯ → Import bookmarks… → Chrome → Import from Chrome lands them in "Imported from Chrome …".

## MCP endpoint

The server is `$SCHNELLBUCH_MCP_URL`. Keep keys and tokens out of logs.

- **API key:** `$ADA_MCP_KEY` and `$BOB_MCP_KEY` from `env.sh`, or Settings → "Create API key", or (after sourcing `env.sh`, from the repo root) `bunx convex run mcp:createApiKeyForUser '{"userId":"'$ADA_USER_ID'","name":"verify"}'`. Send JSON-RPC (`tools/list`, `tools/call`) with `Authorization: Bearer <key>`, `content-type: application/json`, `accept: application/json, text/event-stream`, `mcp-protocol-version: 2025-06-18`. For a real client: `claude -p "<task>" --strict-mcp-config --mcp-config <file> --allowedTools="mcp__schnellbuch__*"`.
- **OAuth (what Claude and ChatGPT connectors do):** register a client at `/mcp/oauth/register`, open `/mcp/oauth/authorize` with PKCE in the signed-in browser session, approve on `/connect`, catch the redirect with a one-shot local listener, then exchange the code at `/mcp/oauth/token`.
- **Device code:** `POST /mcp/oauth/device` with `client_id=mcp-agent`, open `verification_uri_complete`, tick the code-match box, Allow, then poll `/mcp/oauth/token`.
- Cross-user: Bob's key must get "Folder not found." / "Bookmark not found." for Ada's IDs, including in the bulk tools (`move_items`, `delete_bookmarks`, `undo_change`).

## Production smoke check

After a production deploy (never deploy without the owner asking), run `bun run smoke` with `SMOKE_SITE_URL`, `SMOKE_MCP_URL`, and optionally `SMOKE_MCP_KEY` (the owner's own key; never print it). It only reads, and checks:

- the sign-in page loads;
- the manifest and service worker are served;
- MCP answers 401 with OAuth discovery without credentials, and lists tools with a key;
- `/connect` sends `frame-ancestors 'none'`.

Put its output in the PR. It also works against a local production build (see "Offline and install").

## Stop

`agent-browser close`, then `bun run dev:verify down` (data is kept for next time).
