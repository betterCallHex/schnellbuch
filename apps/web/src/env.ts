import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

// The page's Content-Security-Policy forbids eval; without this, Zod probes
// for it on first use and the browser logs a violation.
z.config({ jitless: true });

export const env = createEnv({
  clientPrefix: "VITE_",
  shared: {
    PROD: z.boolean(),
  },
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_CONVEX_SITE_URL: z.url(),
    VITE_SITE_URL: z.url(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
