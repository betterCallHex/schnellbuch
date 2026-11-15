import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { UserMutationCtx, UserQueryCtx } from "../functions";
import type { BookmarkFileSource, FileNode } from "./netscape";
import { normalizeUrl, placeholderTitle } from "./url";

// Items per mutation: well inside Convex's per-transaction read, write and
// scheduling limits even when every bookmark checks for a duplicate.
export const IMPORT_BATCH_SIZE = 250;
// Favicon fetches are spread out so one import doesn't fire thousands of
// requests at once.
const FAVICON_SPACING_MS = 300;
const MAX_TITLE_LENGTH = 1000;
// An import still "running" after this long died without finishing.
const STALE_IMPORT_MS = 15 * 60 * 1000;
const ROOT_KEY = "root";

export const importItem = v.union(
  v.object({
    kind: v.literal("folder"),
    key: v.string(),
    parentKey: v.string(),
    title: v.string(),
  }),
  v.object({
    kind: v.literal("bookmark"),
    parentKey: v.string(),
    title: v.string(),
    url: v.string(),
    addedAt: v.optional(v.number()),
  })
);

type ImportItem = Infer<typeof importItem>;

// Folders come before everything inside them, so batches can run in order.
export function flattenForImport(nodes: FileNode[]) {
  const items: ImportItem[] = [];
  let nextKey = 0;
  const visit = (children: FileNode[], parentKey: string) => {
    for (const node of children) {
      if (node.kind === "bookmark") {
        items.push({
          kind: "bookmark",
          parentKey,
          title: node.title,
          url: node.url,
          addedAt: node.addedAt,
        });
      } else {
        nextKey += 1;
        const key = `f${nextKey}`;
        items.push({ kind: "folder", key, parentKey, title: node.title });
        visit(node.children, key);
      }
    }
  };
  visit(nodes, ROOT_KEY);
  return items;
}

export function importFolderName(source: BookmarkFileSource, now: Date) {
  const day = now.toISOString().slice(0, "YYYY-MM-DD".length);
  return source === "a browser"
    ? `Imported bookmarks ${day}`
    : `Imported from ${source} ${day}`;
}

export async function beginImport(
  ctx: UserMutationCtx,
  {
    fileName,
    source,
    total,
  }: { fileName: string; source: BookmarkFileSource; total: number }
) {
  const running = await latestImport(ctx);
  if (running?.status === "running") {
    throw new ConvexError(
      "An import is already running. Wait for it to finish, then try again."
    );
  }
  const folderId = await ctx.db.insert("folders", {
    userId: ctx.userId,
    name: importFolderName(source, new Date()),
  });
  const importId = await ctx.db.insert("imports", {
    userId: ctx.userId,
    fileName,
    source,
    status: "running",
    folderId,
    total,
    imported: 0,
    duplicates: 0,
    nonWeb: 0,
    failed: 0,
  });
  return { importId, folderId, rootKey: ROOT_KEY };
}

export async function writeImportBatch(
  ctx: UserMutationCtx,
  {
    importId,
    parents,
    items,
  }: {
    importId: Id<"imports">;
    parents: Record<string, Id<"folders">>;
    items: ImportItem[];
  }
) {
  const record = await getOwnedImport(ctx, importId);
  const folderIds = new Map(Object.entries(parents));
  const counts = { imported: 0, duplicates: 0, nonWeb: 0, failed: 0 };
  for (const item of items) {
    const parentId = folderIds.get(item.parentKey);
    if (!parentId) {
      throw new Error(`Import batch is missing parent ${item.parentKey}`);
    }
    if (item.kind === "folder") {
      folderIds.set(
        item.key,
        // biome-ignore lint/performance/noAwaitInLoops: items go in order so a folder exists before its contents and a link seen earlier in the batch counts as a duplicate
        await ctx.db.insert("folders", {
          userId: ctx.userId,
          name: cleanText(item.title) || "Untitled folder",
          parentId,
        })
      );
      continue;
    }
    const outcome = await importBookmark(ctx, item, parentId, {
      faviconDelayMs: (record.imported + counts.imported) * FAVICON_SPACING_MS,
    });
    counts[outcome] += 1;
  }
  await ctx.db.patch(importId, {
    imported: record.imported + counts.imported,
    duplicates: record.duplicates + counts.duplicates,
    nonWeb: record.nonWeb + counts.nonWeb,
    failed: record.failed + counts.failed,
  });
  return Object.fromEntries(folderIds);
}

export async function finishImport(
  ctx: UserMutationCtx,
  { importId, error }: { importId: Id<"imports">; error?: string }
) {
  await getOwnedImport(ctx, importId);
  await ctx.db.patch(importId, {
    status: error ? "failed" : "done",
    error,
    finishedAt: Date.now(),
  });
  return ctx.db.get(importId);
}

export async function latestImport(ctx: UserQueryCtx) {
  const record = await ctx.db
    .query("imports")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .order("desc")
    .first();
  if (record?.status === "running" && isStale(record._creationTime)) {
    return {
      ...record,
      status: "failed" as const,
      error: "The import stopped before it finished.",
    };
  }
  return record;
}

async function importBookmark(
  ctx: UserMutationCtx,
  item: Extract<ImportItem, { kind: "bookmark" }>,
  folderId: Id<"folders">,
  { faviconDelayMs }: { faviconDelayMs: number }
) {
  let url: string;
  try {
    url = normalizeUrl(item.url);
  } catch {
    return "nonWeb" as const;
  }
  const existing = await ctx.db
    .query("bookmarks")
    .withIndex("by_user_url", (q) => q.eq("userId", ctx.userId).eq("url", url))
    .first();
  if (existing) {
    return "duplicates" as const;
  }
  const title = cleanText(item.title);
  try {
    const bookmarkId = await ctx.db.insert("bookmarks", {
      userId: ctx.userId,
      url,
      title: title || placeholderTitle(url),
      folderId,
      savedAt: item.addedAt ?? Date.now(),
    });
    await ctx.scheduler.runAfter(
      faviconDelayMs,
      internal.metadata.fetchMetadata,
      { bookmarkId, keepTitle: title.length > 0 }
    );
    return "imported" as const;
  } catch {
    return "failed" as const;
  }
}

async function getOwnedImport(ctx: UserQueryCtx, importId: Id<"imports">) {
  const record = await ctx.db.get(importId);
  if (!record || record.userId !== ctx.userId) {
    throw new ConvexError("Import not found.");
  }
  return record;
}

function cleanText(text: string) {
  return text.trim().slice(0, MAX_TITLE_LENGTH);
}

function isStale(startedAt: number) {
  return Date.now() - startedAt > STALE_IMPORT_MS;
}
