import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { createAuth } from "./auth";

// Documents deleted per mutation, well inside Convex's write limits.
const PURGE_BATCH = 1000;

// Removes everything a deleted account owned: its agents' access, then its
// library, a batch at a time until nothing is left.
export const purge = internalMutation({
  args: { userId: v.string(), connectionsRevoked: v.optional(v.boolean()) },
  handler: async (ctx, { userId, connectionsRevoked }) => {
    if (!connectionsRevoked) {
      const grants = await ctx.runQuery(components.mcp.grants.list, {
        userId,
      });
      await Promise.all(
        grants.map((grant) =>
          ctx.runMutation(components.mcp.grants.revoke, {
            userId,
            grantId: grant._id,
          })
        )
      );
    }
    const batches = await Promise.all([
      ctx.db
        .query("bookmarks")
        .withIndex("by_user_folder", (q) => q.eq("userId", userId))
        .take(PURGE_BATCH),
      ctx.db
        .query("folders")
        .withIndex("by_user_parent", (q) => q.eq("userId", userId))
        .take(PURGE_BATCH),
      ctx.db
        .query("imports")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(PURGE_BATCH),
      ctx.db
        .query("changes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(PURGE_BATCH),
    ]);
    const ids = batches.flat().map((document) => document._id);
    const now = ids.slice(0, PURGE_BATCH);
    await Promise.all(now.map((id) => ctx.db.delete(id)));
    const more = batches.some((batch) => batch.length === PURGE_BATCH);
    if (more || ids.length > now.length) {
      await ctx.scheduler.runAfter(0, internal.account.purge, {
        userId,
        connectionsRevoked: true,
      });
    }
    return { deleted: now.length, done: !(more || ids.length > now.length) };
  },
});

// A sign-in code for an address, without sending any email. For the owner
// of a deployment, with deploy credentials, when email isn't set up or
// doesn't arrive, and for scripts that sign in test accounts:
//   bunx convex run account:signInCode '{"email":"me@example.com"}'
// It replaces any code already sent to that address.
export const signInCode = internalAction({
  args: { email: v.string() },
  handler: (ctx, { email }) =>
    createAuth(ctx).api.createVerificationOTP({
      body: { email: email.trim().toLowerCase(), type: "sign-in" },
    }),
});
