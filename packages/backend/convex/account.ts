import { ConvexError, v } from "convex/values";
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

// Sets a new password for an account and signs it out everywhere. For the
// owner of a deployment when someone forgets theirs (SchnellBuch sends no
// email), with deploy credentials:
//   bunx convex run account:setPassword '{"email":"me@example.com","password":"…"}'
export const setPassword = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const context = await createAuth(ctx).$context;
    const found = await context.internalAdapter.findUserByEmail(
      email.trim().toLowerCase()
    );
    if (!found) {
      throw new ConvexError(`No account for ${email}.`);
    }
    const { minPasswordLength, maxPasswordLength } = context.password.config;
    if (
      password.length < minPasswordLength ||
      password.length > maxPasswordLength
    ) {
      throw new ConvexError(
        `A password needs ${minPasswordLength} to ${maxPasswordLength} characters.`
      );
    }
    await context.internalAdapter.updatePassword(
      found.user.id,
      await context.password.hash(password)
    );
    await context.internalAdapter.deleteUserSessions(found.user.id);
    return { updated: found.user.email };
  },
});
