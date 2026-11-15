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
  }).index("by_user_folder", ["userId", "folderId"]),
});
