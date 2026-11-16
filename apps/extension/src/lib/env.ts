import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";
import { DEFAULT_SERVER_URL } from "./server-access";

export const env = createEnv({
  clientPrefix: "WXT_",
  shared: {
    FIREFOX: z.boolean(),
  },
  client: {
    // The SchnellBuch the extension saves to until the user picks another on
    // its options page. Set it when building for your production address.
    WXT_SCHNELLBUCH_URL: z.url().default(DEFAULT_SERVER_URL),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
