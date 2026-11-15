import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  folders: defineTable({
    userId: v.string(),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
  }).index("by_user_parent", ["userId", "parentId"]),

  bookmarks: defineTable({
    userId: v.string(),
    url: v.string(),
    title: v.string(),
    folderId: v.optional(v.id("folders")),
    faviconUrl: v.optional(v.string()),
    // When the user saved it, in ms since the epoch. Imports keep the
    // browser's original date. Optional only until `migrations:backfillSavedAt`
    // has run on every deployment; read it through `savedAtOf`.
    savedAt: v.optional(v.number()),
  })
    .index("by_user_folder", ["userId", "folderId"])
    .index("by_user_url", ["userId", "url"]),
});
