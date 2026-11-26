import { createEnv } from "@t3-oss/env-core";
import { backendEnvSchema } from "./model/env";

export const env = createEnv({
  server: backendEnvSchema,
  runtimeEnv: process.env,
  isServer: true,
  emptyStringAsUndefined: true,
});
