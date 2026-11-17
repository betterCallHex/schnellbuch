import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { env } from "./env";
import { tryAgainIn, waitBefore } from "./model/limits";
import { isSignupAllowed, SIGNUPS_CLOSED } from "./model/signup";

export const authComponent = createClient<DataModel>(components.betterAuth);

const PASSWORD_PATHS = new Set(["/sign-in/email", "/sign-up/email"]);

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: env.SITE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    user: {
      deleteUser: {
        enabled: true,
        // The account is gone; its library, imports, changes and agent
        // connections follow in the background.
        afterDelete: async (user) => {
          if ("scheduler" in ctx) {
            await ctx.scheduler.runAfter(0, internal.account.purge, {
              userId: user.id,
            });
          }
        },
      },
    },
    plugins: [convex({ authConfig })],
    hooks: {
      // Password checks are slow on purpose; cap attempts per address so
      // nobody can guess a password or tie up the backend.
      before: createAuthMiddleware(async (request) => {
        if (!(PASSWORD_PATHS.has(request.path) && "runMutation" in ctx)) {
          return;
        }
        const email = String(request.body?.email ?? "")
          .trim()
          .toLowerCase();
        const wait = await waitBefore(ctx, "passwordAttempt", email);
        if (wait !== undefined) {
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "TOO_MANY_ATTEMPTS",
            message: `Too many attempts. ${tryAgainIn(wait)}`,
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Every route that creates a user passes through here, not only
          // the email form.
          before: (user) => {
            if (!isSignupAllowed(user.email, env.SIGNUP_ALLOWED_EMAILS)) {
              throw new APIError("FORBIDDEN", SIGNUPS_CLOSED);
            }
            return Promise.resolve();
          },
        },
      },
    },
  });
}

export const currentUser = query({
  args: {},
  handler: (ctx) => authComponent.safeGetAuthUser(ctx),
});
