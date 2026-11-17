import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { agentMutation, requireUserId, userQuery } from "./functions";
import {
  beginImport,
  finishImport,
  flattenForImport,
  IMPORT_BATCH_SIZE,
  importItem,
  latestImport,
  writeImportBatch,
} from "./model/import";
import { enforceLimit } from "./model/limits";
import {
  BOOKMARK_FILE_SOURCES,
  countBookmarks,
  parseBookmarkFile,
} from "./model/netscape";

// Browser exports are a few MB; this stays under Convex's argument limit.
const MAX_FILE_LENGTH = 15_000_000;
const bookmarkSource = v.union(
  ...BOOKMARK_FILE_SOURCES.map((name) => v.literal(name))
);

// Imports a browser's bookmarks file into one new folder. The file is fully
// parsed before anything is written, so a bad file writes nothing.
export const start = action({
  args: {
    fileName: v.string(),
    html: v.string(),
    source: v.optional(bookmarkSource),
  },
  handler: async (
    ctx,
    { fileName, html, source }
  ): Promise<Doc<"imports"> | null> => {
    const userId = await requireUserId(ctx);
    await enforceLimit(ctx, "importFile", userId, "imports");
    if (html.length > MAX_FILE_LENGTH) {
      throw new ConvexError(
        "That file is too big to import. Bookmarks exports are usually a few MB."
      );
    }
    const parsed = parseBookmarkFile(html);
    const items = flattenForImport(parsed.children);
    if (items.length === 0) {
      throw new ConvexError("That bookmarks file is empty.");
    }
    const {
      importId,
      folderId,
      rootKey,
    }: { importId: Id<"imports">; folderId: Id<"folders">; rootKey: string } =
      await ctx.runMutation(internal.imports.begin, {
        userId,
        fileName: fileName.slice(0, 200),
        source: source ?? parsed.source,
        total: countBookmarks(parsed.children),
      });
    const folderIds: Record<string, Id<"folders">> = { [rootKey]: folderId };
    try {
      for (let offset = 0; offset < items.length; offset += IMPORT_BATCH_SIZE) {
        const batch = items.slice(offset, offset + IMPORT_BATCH_SIZE);
        const parents = Object.fromEntries(
          [...new Set(batch.map((item) => item.parentKey))]
            .map((key) => [key, folderIds[key]] as const)
            .filter(
              (entry): entry is [string, Id<"folders">] =>
                entry[1] !== undefined
            )
        );
        // biome-ignore lint/performance/noAwaitInLoops: batches run in order so every folder exists before what goes inside it
        const created: Record<string, Id<"folders">> = await ctx.runMutation(
          internal.imports.writeBatch,
          { userId, importId, parents, items: batch }
        );
        Object.assign(folderIds, created);
      }
    } catch (error) {
      await ctx.runMutation(internal.imports.finish, {
        userId,
        importId,
        error: "The import stopped before it finished. Try again.",
      });
      throw error;
    }
    return await ctx.runMutation(internal.imports.finish, { userId, importId });
  },
});

export const latest = userQuery({ args: {}, handler: latestImport });

export const begin = agentMutation({
  args: { fileName: v.string(), source: bookmarkSource, total: v.number() },
  handler: beginImport,
});

export const writeBatch = agentMutation({
  args: {
    importId: v.id("imports"),
    parents: v.record(v.string(), v.id("folders")),
    items: v.array(importItem),
  },
  handler: writeImportBatch,
});

export const finish = agentMutation({
  args: { importId: v.id("imports"), error: v.optional(v.string()) },
  handler: finishImport,
});
