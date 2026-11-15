import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    SITE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
  },
  runtimeEnv: process.env,
  isServer: true,
  emptyStringAsUndefined: true,
});
