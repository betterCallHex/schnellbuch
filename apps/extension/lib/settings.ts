import { storage } from "wxt/utils/storage";
import { env } from "./env";

// Synced with the browser profile, so every computer saves to the same place.
export const serverUrl = storage.defineItem<string>("sync:serverUrl", {
  fallback: env.WXT_SCHNELLBUCH_URL,
});
