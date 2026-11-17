import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Agent changes stay undoable this long; imports are kept for their summary
// just as long.
export const KEEP_HISTORY_MS = 90 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

// Deletes changes and imports older than KEEP_HISTORY_MS, oldest first, a
// batch at a time: first changes, then imports. Runs daily from crons.ts.
export const pruneHistory = internalMutation({
  args: {
    table: v.optional(v.union(v.literal("changes"), v.literal("imports"))),
  },
  handler: async (ctx, { table = "changes" }) => {
    const cutoff = Date.now() - KEEP_HISTORY_MS;
    const oldest = await ctx.db.query(table).order("asc").take(BATCH_SIZE);
    const expired = oldest.filter(
      (document) => document._creationTime < cutoff
    );
    await Promise.all(expired.map((document) => ctx.db.delete(document._id)));
    if (expired.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.housekeeping.pruneHistory, {
        table,
      });
    } else if (table === "changes") {
      await ctx.scheduler.runAfter(0, internal.housekeeping.pruneHistory, {
        table: "imports",
      });
    }
    return { deleted: expired.length };
  },
});
