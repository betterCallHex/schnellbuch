import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "WXT_",
  client: {
    // The SchnellBuch the extension saves to until the user picks another on
    // its options page. Set it when building for your production address.
    WXT_SCHNELLBUCH_URL: z.url().default("http://localhost:3000"),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
