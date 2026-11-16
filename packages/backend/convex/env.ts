import { createEnv } from "@t3-oss/env-core";
import { backendEnvSchema } from "./model/env";
import { parseAllowList } from "./model/signup";

export const env = createEnv({
  server: {
    ...backendEnvSchema,
    SIGNUP_ALLOWED_EMAILS:
      backendEnvSchema.SIGNUP_ALLOWED_EMAILS.transform(parseAllowList),
  },
  runtimeEnv: process.env,
  isServer: true,
  emptyStringAsUndefined: true,
});
