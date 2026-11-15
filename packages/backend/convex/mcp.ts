import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker-provider.js";
import { ConvexError } from "convex/values";
import * as z from "zod";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { searchBookmarks } from "./model/search";
import { hashToken } from "./model/tokens";
import { buildFolderTree, flattenFolderTree } from "./model/tree";

const BEARER = /^Bearer\s+(?<token>\S+)$/iu;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

const INSTRUCTIONS =
  "SchnellBuch holds the user's bookmarks in nested folders. Call list_folders to learn folder IDs and paths before filing bookmarks. A bookmark outside every folder is unsorted. Deleting a folder moves its bookmarks and subfolders up to its parent.";

export const handleMcp = httpAction(async (ctx, request) => {
  const userId = await authenticate(ctx, request);
  if (!userId) {
    return new Response("Missing or invalid SchnellBuch token.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="SchnellBuch"' },
    });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await createBookmarkServer(ctx, userId).connect(transport);
  return transport.handleRequest(request);
});

async function authenticate(ctx: ActionCtx, request: Request) {
  const token = request.headers.get("authorization")?.match(BEARER)
    ?.groups?.token;
  if (!token) {
    return null;
  }
  return ctx.runQuery(internal.tokens.userIdForTokenHash, {
    tokenHash: await hashToken(token),
  });
}

function createBookmarkServer(ctx: ActionCtx, userId: string) {
  const server = new McpServer(
    { name: "schnellbuch", version: "0.1.0" },
    {
      instructions: INSTRUCTIONS,
      jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
    }
  );
  const library = () => readLibrary(ctx, userId);
  const limit = z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe(`Defaults to ${DEFAULT_LIMIT}.`);

  server.registerTool(
    "list_folders",
    {
      title: "List folders",
      description:
        "Every folder with its ID, full path, parent and bookmark count.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => respond(async () => (await library()).folderSummaries())
  );

  server.registerTool(
    "list_bookmarks",
    {
      title: "List bookmarks",
      description:
        "Bookmarks newest first. Omit folderId for all bookmarks, pass null for unsorted ones.",
      inputSchema: { folderId: z.string().nullable().optional(), limit },
      annotations: { readOnlyHint: true },
    },
    ({ folderId, limit: count }) =>
      respond(async () => {
        const { bookmarks, describe } = await library();
        const inFolder =
          folderId === undefined
            ? bookmarks
            : bookmarks.filter(
                (bookmark) => (bookmark.folderId ?? null) === folderId
              );
        return inFolder.slice(0, count ?? DEFAULT_LIMIT).map(describe);
      })
  );

  server.registerTool(
    "search_bookmarks",
    {
      title: "Search bookmarks",
      description:
        "Fuzzy search over bookmark titles and URLs, best match first.",
      inputSchema: { query: z.string().min(1), limit },
      annotations: { readOnlyHint: true },
    },
    ({ query, limit: count }) =>
      respond(async () => {
        const { bookmarks, describe } = await library();
        return searchBookmarks(bookmarks, query, count ?? DEFAULT_LIMIT).map(
          describe
        );
      })
  );

  server.registerTool(
    "add_bookmark",
    {
      title: "Add bookmark",
      description:
        "Save a link. Without a title, the page title is fetched. Without folderId, it lands in unsorted.",
      inputSchema: {
        url: z.string().min(1),
        title: z.string().optional(),
        folderId: z.string().optional(),
      },
    },
    ({ url, title, folderId }) =>
      respond(async () => {
        const bookmarkId = await ctx.runMutation(
          internal.bookmarks.addForAgent,
          {
            userId,
            url,
            title,
            folderId: folderId as Id<"folders"> | undefined,
          }
        );
        return { bookmarkId };
      })
  );

  server.registerTool(
    "update_bookmark",
    {
      title: "Update bookmark",
      description:
        "Change a bookmark's title or URL, or move it. folderId null moves it to unsorted.",
      inputSchema: {
        bookmarkId: z.string(),
        title: z.string().optional(),
        url: z.string().optional(),
        folderId: z.string().nullable().optional(),
      },
      annotations: { idempotentHint: true },
    },
    ({ bookmarkId, title, url, folderId }) =>
      respond(() =>
        ctx.runMutation(internal.bookmarks.updateForAgent, {
          userId,
          bookmarkId: bookmarkId as Id<"bookmarks">,
          title,
          url,
          folderId: folderId as Id<"folders"> | null | undefined,
        })
      )
  );

  server.registerTool(
    "delete_bookmark",
    {
      title: "Delete bookmark",
      description: "Delete a bookmark for good.",
      inputSchema: { bookmarkId: z.string() },
      annotations: { destructiveHint: true },
    },
    ({ bookmarkId }) =>
      respond(() =>
        ctx.runMutation(internal.bookmarks.removeForAgent, {
          userId,
          bookmarkId: bookmarkId as Id<"bookmarks">,
        })
      )
  );

  server.registerTool(
    "create_folder",
    {
      title: "Create folder",
      description: "Create a folder, at the top level or inside parentId.",
      inputSchema: { name: z.string().min(1), parentId: z.string().optional() },
    },
    ({ name, parentId }) =>
      respond(async () => {
        const folderId = await ctx.runMutation(
          internal.folders.createForAgent,
          {
            userId,
            name,
            parentId: parentId as Id<"folders"> | undefined,
          }
        );
        return { folderId };
      })
  );

  server.registerTool(
    "update_folder",
    {
      title: "Update folder",
      description:
        "Rename a folder or move it. parentId null moves it to the top level.",
      inputSchema: {
        folderId: z.string(),
        name: z.string().optional(),
        parentId: z.string().nullable().optional(),
      },
      annotations: { idempotentHint: true },
    },
    ({ folderId, name, parentId }) =>
      respond(() =>
        ctx.runMutation(internal.folders.updateForAgent, {
          userId,
          folderId: folderId as Id<"folders">,
          name,
          parentId: parentId as Id<"folders"> | null | undefined,
        })
      )
  );

  server.registerTool(
    "delete_folder",
    {
      title: "Delete folder",
      description:
        "Delete a folder. Its bookmarks and subfolders move up to its parent.",
      inputSchema: { folderId: z.string() },
      annotations: { destructiveHint: true },
    },
    ({ folderId }) =>
      respond(() =>
        ctx.runMutation(internal.folders.removeForAgent, {
          userId,
          folderId: folderId as Id<"folders">,
        })
      )
  );

  return server;
}

async function readLibrary(ctx: ActionCtx, userId: string) {
  const [folders, bookmarks] = await Promise.all([
    ctx.runQuery(internal.folders.listForAgent, { userId }),
    ctx.runQuery(internal.bookmarks.listForAgent, { userId }),
  ]);
  const flatTree = flattenFolderTree(buildFolderTree(folders));
  const pathById = new Map(flatTree.map((folder) => [folder._id, folder.path]));
  const countByFolder = Map.groupBy(bookmarks, (bookmark) => bookmark.folderId);
  return {
    bookmarks,
    describe: (bookmark: Doc<"bookmarks">) => ({
      id: bookmark._id,
      title: bookmark.title,
      url: bookmark.url,
      folderId: bookmark.folderId ?? null,
      folderPath: bookmark.folderId
        ? (pathById.get(bookmark.folderId) ?? null)
        : null,
      savedAt: new Date(bookmark._creationTime).toISOString(),
    }),
    folderSummaries: () =>
      flatTree.map((folder) => ({
        id: folder._id,
        name: folder.name,
        path: folder.path,
        parentId: folder.parentId ?? null,
        bookmarkCount: countByFolder.get(folder._id)?.length ?? 0,
      })),
  };
}

async function respond(run: () => Promise<unknown>) {
  try {
    const result = await run();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result ?? { ok: true }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: errorMessage(error) }],
    };
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return error instanceof Error ? error.message : String(error);
}
