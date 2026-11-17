import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { folderColor, folderMark } from "./model/style";

// What reverses one step of a change an agent made: put a bookmark or
// folder back where and as it was, re-create a deleted one, or remove one
// that was added.
export const undoStep = v.union(
  v.object({
    kind: v.literal("moveBookmark"),
    bookmarkId: v.id("bookmarks"),
    folderId: v.optional(v.id("folders")),
  }),
  v.object({
    kind: v.literal("moveFolder"),
    folderId: v.id("folders"),
    parentId: v.optional(v.id("folders")),
  }),
  v.object({
    kind: v.literal("restoreBookmark"),
    url: v.string(),
    title: v.string(),
    folderId: v.optional(v.id("folders")),
    savedAt: v.number(),
    faviconUrl: v.optional(v.string()),
    note: v.optional(v.string()),
    urlFromAgent: v.optional(v.literal(true)),
  }),
  v.object({
    kind: v.literal("removeBookmark"),
    bookmarkId: v.id("bookmarks"),
  }),
  // Put a bookmark's link, title and folder back as they were.
  v.object({
    kind: v.literal("editBookmark"),
    bookmarkId: v.id("bookmarks"),
    url: v.string(),
    title: v.string(),
    note: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    urlFromAgent: v.optional(v.literal(true)),
  }),
  // Put a folder's name and parent back as they were.
  v.object({
    kind: v.literal("editFolder"),
    folderId: v.id("folders"),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
  }),
  // Remove a folder that was created; anything put in it since moves up.
  v.object({ kind: v.literal("removeFolder"), folderId: v.id("folders") }),
  // Re-create a deleted folder and move back what was directly inside it.
  v.object({
    kind: v.literal("restoreFolder"),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    color: v.optional(folderColor),
    mark: v.optional(folderMark),
    folderIds: v.array(v.id("folders")),
    bookmarkIds: v.array(v.id("bookmarks")),
  })
);

export default defineSchema({
  folders: defineTable({
    userId: v.string(),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    color: v.optional(folderColor),
    mark: v.optional(folderMark),
  }).index("by_user_parent", ["userId", "parentId"]),

  bookmarks: defineTable({
    userId: v.string(),
    url: v.string(),
    title: v.string(),
    folderId: v.optional(v.id("folders")),
    faviconUrl: v.optional(v.string()),
    // The user's (or an agent's) own words about the page.
    note: v.optional(v.string()),
    // When the user saved it, in ms since the epoch. Imports keep the
    // browser's original date. Optional only until `migrations:backfillSavedAt`
    // has run on every deployment; read it through `savedAtOf`.
    savedAt: v.optional(v.number()),
    // The URL came from an agent, so the backend never fetches it.
    urlFromAgent: v.optional(v.literal(true)),
    // Set by check_links: whether the page still answers.
    linkCheck: v.optional(
      v.object({
        checkedAt: v.number(),
        status: v.union(
          v.literal("ok"),
          v.literal("gone"),
          v.literal("unsure")
        ),
        httpStatus: v.optional(v.number()),
      })
    ),
  })
    .index("by_user_folder", ["userId", "folderId"])
    .index("by_user_url", ["userId", "url"]),

  // One row per bookmarks-file import, so progress and the summary survive
  // a page reload.
  imports: defineTable({
    userId: v.string(),
    fileName: v.string(),
    source: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    folderId: v.id("folders"),
    total: v.number(),
    imported: v.number(),
    duplicates: v.number(),
    nonWeb: v.number(),
    failed: v.number(),
    error: v.optional(v.string()),
    finishedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // Batches of changes an agent made, each undoable in one step.
  changes: defineTable({
    userId: v.string(),
    summary: v.string(),
    undo: v.array(undoStep),
    undoneAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
});
