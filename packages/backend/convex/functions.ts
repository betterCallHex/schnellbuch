import type { Auth } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";

export type UserQueryCtx = QueryCtx & { userId: string };
export type UserMutationCtx = MutationCtx & { userId: string };

export async function requireUserId(ctx: { auth: Auth }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Sign in to continue.");
  }
  return identity.subject;
}

export const userQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ userId: await requireUserId(ctx) }))
);

export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ userId: await requireUserId(ctx) }))
);

const asAgentUser = {
  args: { userId: v.string() },
  input: (_ctx: unknown, { userId }: { userId: string }) =>
    Promise.resolve({ ctx: { userId }, args: {} }),
};

export const agentQuery = customQuery(internalQuery, asAgentUser);

export const agentMutation = customMutation(internalMutation, asAgentUser);
