import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { env } from "./env";
import { tryAgainIn, waitBefore } from "./model/limits";
import { isSignupAllowed, SIGNUPS_CLOSED } from "./model/signup";

export const authComponent = createClient<DataModel>(components.betterAuth);

const CODE_PATHS = new Set([
  "/email-otp/send-verification-otp",
  "/sign-in/email-otp",
]);
const CODE_LIFETIME_SECONDS = 5 * 60;

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: env.SITE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    session: { freshAge: CODE_LIFETIME_SECONDS },
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
    plugins: [
      convex({ authConfig }),
      emailOTP({
        expiresIn: CODE_LIFETIME_SECONDS,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp }, request) => {
          const known =
            await request?.context.internalAdapter.findUserByEmail(email);
          if (
            !(
              (known || isSignupAllowed(email, env.SIGNUP_ALLOWED_EMAILS)) &&
              "scheduler" in ctx
            )
          ) {
            return;
          }
          await ctx.scheduler.runAfter(0, internal.email.sendSignInCode, {
            email,
            code: otp,
          });
        },
      }),
    ],
    hooks: {
      // Each code request sends an email and each sign-in checks a code;
      // cap both per address so nobody can flood an inbox, burn the email
      // quota or guess a code.
      before: createAuthMiddleware(async (request) => {
        if (!(CODE_PATHS.has(request.path) && "runMutation" in ctx)) {
          return;
        }
        const email = String(request.body?.email ?? "")
          .trim()
          .toLowerCase();
        const wait = await waitBefore(ctx, "signInAttempt", email);
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
