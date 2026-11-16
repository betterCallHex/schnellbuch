import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { env } from "./env";
import { isSignupAllowed, SIGNUPS_CLOSED } from "./model/signup";

export const authComponent = createClient<DataModel>(components.betterAuth);

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth({
    baseURL: env.SITE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    plugins: [convex({ authConfig })],
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
