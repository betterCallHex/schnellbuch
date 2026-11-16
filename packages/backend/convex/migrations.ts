import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const BATCH_SIZE = 200;

// Gives every bookmark saved before `savedAt` existed its creation time.
// Safe to run again: bookmarks that already have a date are left alone.
// Run with `bunx convex run migrations:backfillSavedAt` (add `--prod` for production).
export const backfillSavedAt = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("bookmarks")
      .paginate({ cursor: cursor ?? null, numItems: BATCH_SIZE });
    const missing = page.page.filter(
      (bookmark) => bookmark.savedAt === undefined
    );
    await Promise.all(
      missing.map((bookmark) =>
        ctx.db.patch(bookmark._id, { savedAt: bookmark._creationTime })
      )
    );
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillSavedAt, {
        cursor: page.continueCursor,
      });
    }
    return { patched: missing.length, done: page.isDone };
  },
});
