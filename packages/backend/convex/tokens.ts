import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { requireUserId, userMutation, userQuery } from "./functions";
import { generateToken, hashToken, previewToken } from "./model/tokens";

export const list = userQuery({
  args: {},
  handler: async (ctx) => {
    const tokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    return tokens.map(({ _id, _creationTime, name, preview }) => ({
      _id,
      _creationTime,
      name,
      preview,
    }));
  },
});

export const create = action({
  args: { name: v.string() },
  handler: async (ctx, { name }): Promise<string> => {
    const userId = await requireUserId(ctx);
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ConvexError("Give the token a name.");
    }
    const token = generateToken();
    await ctx.runMutation(internal.tokens.insert, {
      userId,
      name: trimmedName,
      tokenHash: await hashToken(token),
      preview: previewToken(token),
    });
    return token;
  },
});

export const revoke = userMutation({
  args: { tokenId: v.id("apiTokens") },
  handler: async (ctx, { tokenId }) => {
    const token = await ctx.db.get(tokenId);
    if (!token || token.userId !== ctx.userId) {
      throw new ConvexError("Token not found.");
    }
    await ctx.db.delete(tokenId);
  },
});

export const insert = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    tokenHash: v.string(),
    preview: v.string(),
  },
  handler: (ctx, token) => ctx.db.insert("apiTokens", token),
});

export const userIdForTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const token = await ctx.db
      .query("apiTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    return token?.userId ?? null;
  },
});
