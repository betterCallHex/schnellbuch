import { McpServer, tool } from "@convex-dev/mcp";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { env } from "./env";
import { bookmarkResult, folderResult } from "./model/describe";

const READ = "bookmarks:read";
const WRITE = "bookmarks:write";
const LOCAL = { openWorldHint: false };
const limit = v.optional(v.number());

export const mcp: McpServer = new McpServer(components.mcp, {
  name: "schnellbuch",
  title: "SchnellBuch",
  version: "0.2.0",
  instructions:
    "SchnellBuch holds the user's bookmarks in nested folders. Call list_folders for folder IDs and paths before filing or moving anything, and search_bookmarks to find a bookmark by words. A bookmark outside every folder sits at the top level. Deleting a folder moves its bookmarks and subfolders up to its parent.",
  consentUrl: env.MCP_CONSENT_URL,
  scopes: {
    [READ]: "See your bookmarks and folders",
    [WRITE]: "Add, edit, move and delete your bookmarks and folders",
  },
  tools: {
    list_folders: tool({
      description:
        "Every folder with its ID, full path (like 'Dev / Convex'), parent and bookmark count.",
      returns: v.object({ folders: v.array(folderResult) }),
      annotations: { readOnlyHint: true, ...LOCAL },
      scope: READ,
      handler: async (ctx, _args, user) => ({
        folders: await ctx.runQuery(internal.agent.listFolders, {
          userId: user.userId,
        }),
      }),
    }),
    list_bookmarks: tool({
      description:
        "Bookmarks newest first. Omit folderId for all bookmarks, pass null for top-level ones, or a folder ID for that folder only. Returns at most `limit` (default 50, max 500).",
      args: { folderId: v.optional(v.union(v.string(), v.null())), limit },
      returns: v.object({ bookmarks: v.array(bookmarkResult) }),
      annotations: { readOnlyHint: true, ...LOCAL },
      scope: READ,
      handler: async (ctx, args, user) => ({
        bookmarks: await ctx.runQuery(internal.agent.listBookmarks, {
          userId: user.userId,
          ...args,
        }),
      }),
    }),
    search_bookmarks: tool({
      description:
        "Fuzzy search over bookmark titles and URLs, best match first. Abbreviations work ('cnvx hub' finds 'Convex Developer Hub'). Returns at most `limit` (default 50).",
      args: { query: v.string(), limit },
      returns: v.object({ bookmarks: v.array(bookmarkResult) }),
      annotations: { readOnlyHint: true, ...LOCAL },
      scope: READ,
      handler: async (ctx, args, user) => ({
        bookmarks: await ctx.runQuery(internal.agent.searchBookmarks, {
          userId: user.userId,
          ...args,
        }),
      }),
    }),
    add_bookmark: tool({
      description:
        "Save a link and return the saved bookmark. Without a title, the page's own title is fetched a few seconds later. Without folderId, it goes to the top level.",
      args: {
        url: v.string(),
        title: v.optional(v.string()),
        folderId: v.optional(v.string()),
      },
      returns: bookmarkResult,
      annotations: LOCAL,
      scope: WRITE,
      handler: (ctx, args, user) =>
        ctx.runMutation(internal.agent.addBookmark, {
          userId: user.userId,
          ...args,
        }),
    }),
    update_bookmark: tool({
      description:
        "Change a bookmark's title or URL, or move it to another folder (folderId null moves it to the top level). Returns the updated bookmark.",
      args: {
        bookmarkId: v.string(),
        title: v.optional(v.string()),
        url: v.optional(v.string()),
        folderId: v.optional(v.union(v.string(), v.null())),
      },
      returns: bookmarkResult,
      annotations: { idempotentHint: true, ...LOCAL },
      scope: WRITE,
      handler: (ctx, args, user) =>
        ctx.runMutation(internal.agent.updateBookmark, {
          userId: user.userId,
          ...args,
        }),
    }),
    delete_bookmark: tool({
      description: "Delete a bookmark for good.",
      args: { bookmarkId: v.string() },
      returns: v.object({ deletedBookmarkId: v.string() }),
      annotations: { destructiveHint: true, ...LOCAL },
      scope: WRITE,
      handler: (ctx, args, user) =>
        ctx.runMutation(internal.agent.deleteBookmark, {
          userId: user.userId,
          ...args,
        }),
    }),
    create_folder: tool({
      description:
        "Create a folder at the top level, or inside parentId. Returns the new folder.",
      args: { name: v.string(), parentId: v.optional(v.string()) },
      returns: folderResult,
      annotations: LOCAL,
      scope: WRITE,
      handler: (ctx, args, user) =>
        ctx.runMutation(internal.agent.createFolder, {
          userId: user.userId,
          ...args,
        }),
    }),
    update_folder: tool({
      description:
        "Rename a folder or move it (parentId null moves it to the top level). A folder can't move inside itself. Returns the updated folder.",
      args: {
        folderId: v.string(),
        name: v.optional(v.string()),
        parentId: v.optional(v.union(v.string(), v.null())),
      },
      returns: folderResult,
      annotations: { idempotentHint: true, ...LOCAL },
      scope: WRITE,
      handler: (ctx, args, user) =>
        ctx.runMutation(internal.agent.updateFolder, {
          userId: user.userId,
          ...args,
        }),
    }),
    delete_folder: tool({
      description:
        "Delete a folder. Its bookmarks and subfolders move up to its parent; nothing else is deleted.",
      args: { folderId: v.string() },
      returns: v.object({ deletedFolderId: v.string() }),
      annotations: { destructiveHint: true, ...LOCAL },
      scope: WRITE,
      handler: (ctx, args, user) =>
        ctx.runMutation(internal.agent.deleteFolder, {
          userId: user.userId,
          ...args,
        }),
    }),
  },
});

export const {
  getAuthRequest,
  findAuthRequest,
  authorize,
  listConnections,
  revokeConnection,
  createApiKey,
} = mcp.api({
  getUserId: async (ctx) => (await ctx.auth.getUserIdentity())?.subject ?? null,
});

export const { createApiKeyForUser } = mcp.internalApi();
