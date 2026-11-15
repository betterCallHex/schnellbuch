---
name: verify
description: Start SchnellBuch locally and check a change end to end in a browser with agent-browser, including the MCP endpoint. Use after any meaningful change to the web app or the Convex backend.
---

# Verify SchnellBuch

## Start

1. `bun install` in a fresh worktree.
2. `bun run dev` (run it in the background). It starts `convex dev` (pushes `packages/backend/convex` to your dev deployment) and Vite on `http://localhost:3000`. Use `PORT=3001 bun run dev` when another checkout holds 3000.
3. First run on a new machine: `convex dev` asks you to log in and pick a project, then writes `packages/backend/.env.local`. Set the backend secrets once:
   `cd packages/backend && bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)" && bunx convex env set SITE_URL http://localhost:3000 && bunx convex env set MCP_CONSENT_URL http://localhost:3000/connect`.
4. Wait for `Convex functions ready!` and for `curl -s -o /dev/null -w '%{http_code}' localhost:3000/sign-in` to return 200.

## Log in

Use a named agent-browser session. Sign up through the UI with a throwaway email (`agent-<anything>@schnellbuch.test`, password of 8+ characters) on `/sign-in` → "New here? Create an account". Each account starts empty; create the folders and bookmarks the check needs.

## What to check

- The top level shows folders, then bookmarks, as a grid. Click selects, double-click (or ↵) opens, ⌘↑ goes up, Back/Forward in the toolbar follow history.
- Paste a link into ⌘K → "Save …", or dispatch a `paste` event on the page with a link: it saves into the open folder and the title arrives within a few seconds.
- Right-click a tile for Open / Edit / Move to / Copy link / Delete. ⌘⌫ deletes the selection; the toast's Undo restores a bookmark.
- Drag a tile onto a folder tile, or onto a crumb in the path bar to move it up. Use `agent-browser mouse down/move/up` with `--steps`; `agent-browser drag` is too fast for dnd-kit.
- Bookmarklet: open `/add?url=<encoded>&title=<encoded>` at 420×320.
- Phone width: `agent-browser set device "iPhone 14"`; a tap opens a tile.

## MCP endpoint

The server is `<VITE_CONVEX_SITE_URL>/mcp`. Keep keys and tokens out of logs.

- **API key:** Settings → "Create API key", or `cd packages/backend && bunx convex run mcp:createApiKeyForUser '{"userId":"<user id>","name":"verify"}'`. Send JSON-RPC (`tools/list`, `tools/call`) with `Authorization: Bearer <key>`, `content-type: application/json`, `accept: application/json, text/event-stream`, `mcp-protocol-version: 2025-06-18`. For a real client: `claude -p "<task>" --strict-mcp-config --mcp-config <file> --allowedTools="mcp__schnellbuch__*"`.
- **OAuth (what Claude and ChatGPT connectors do):** register a client at `/mcp/oauth/register`, open `/mcp/oauth/authorize` with PKCE in the signed-in browser session, approve on `/connect`, catch the redirect with a one-shot local listener, then exchange the code at `/mcp/oauth/token`.
- **Device code:** `POST /mcp/oauth/device` with `client_id=mcp-agent`, open `verification_uri_complete`, tick the code-match box, Allow, then poll `/mcp/oauth/token`.
- Cross-user: a second account's key must get "Folder not found." / "Bookmark not found." for the first account's IDs.

## Stop

`agent-browser close`, then stop `bun run dev`.
