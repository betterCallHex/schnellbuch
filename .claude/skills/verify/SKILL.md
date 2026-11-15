---
name: verify
description: Start SchnellBuch locally and check a change end to end in a browser with agent-browser, including the MCP endpoint. Use after any meaningful change to the web app or the Convex backend.
---

# Verify SchnellBuch

## Start

1. `bun install` in a fresh worktree.
2. `bun run dev` (run it in the background). It starts `convex dev` (pushes `packages/backend/convex` to your dev deployment) and Vite on `http://localhost:3000`. Use `PORT=3001 bun run dev` when another checkout holds 3000.
3. First run on a new machine: `convex dev` asks you to log in and pick a project, then writes `packages/backend/.env.local`. Set the backend secrets once:
   `cd packages/backend && bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)" && bunx convex env set SITE_URL http://localhost:3000`.
4. Wait for `Convex functions ready!` and for `curl -s -o /dev/null -w '%{http_code}' localhost:3000/sign-in` to return 200.

## Log in

Use a named agent-browser session. Sign up through the UI with a throwaway email (`agent-<anything>@schnellbuch.test`, password of 8+ characters) on `/sign-in` → "New here? Create an account". Each account starts empty; create the folders and bookmarks the check needs.

## What to check

- Paste a link into ⌘K → "Save …" saves it; the page title arrives within a few seconds.
- Drag a bookmark row onto a sidebar folder, and a folder onto another folder. Use `agent-browser mouse down/move/up` with `--steps`; `agent-browser drag` is too fast for dnd-kit.
- Bookmarklet: open `/add?url=<encoded>&title=<encoded>` at 420×320.
- Phone width: 390×844, open the folder drawer with "Show folders".

## MCP endpoint

Create a token in Settings and keep it out of logs. Call `<VITE_CONVEX_SITE_URL>/mcp` with `Authorization: Bearer <token>`, `content-type: application/json`, `accept: application/json, text/event-stream`, and JSON-RPC bodies (`initialize`, `tools/list`, `tools/call`). For a real client: `claude -p "<task>" --strict-mcp-config --mcp-config <file> --allowedTools="mcp__schnellbuch__*"`.

## Stop

`agent-browser close`, then stop `bun run dev`.
