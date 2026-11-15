import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";
import { parseAllowList } from "./model/signup";

export const env = createEnv({
  server: {
    SITE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    MCP_CONSENT_URL: z.url(),
    SIGNUP_ALLOWED_EMAILS: z.string().optional().transform(parseAllowList),
  },
  runtimeEnv: process.env,
  isServer: true,
  emptyStringAsUndefined: true,
});
