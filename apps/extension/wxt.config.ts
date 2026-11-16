import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import babel from "@rolldown/plugin-babel";
import { createEnv } from "@t3-oss/env-core";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "wxt";
import * as z from "zod";
import {
  ANY_WEB_PAGE,
  DEFAULT_SERVER_URL,
  serverMatchPattern,
} from "./src/lib/server-access";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const rootEnvFile = `${repoRoot}.env.local`;

const buildEnv = createEnv({
  server: {
    WXT_SCHNELLBUCH_URL: z.url().default(DEFAULT_SERVER_URL),
  },
  runtimeEnv: {
    ...(existsSync(rootEnvFile)
      ? parseEnv(readFileSync(rootEnvFile, "utf8"))
      : {}),
    ...process.env,
  },
  emptyStringAsUndefined: true,
});

export default defineConfig({
  srcDir: "src",
  // React comes in as a WXT module, which adds @vitejs/plugin-react itself.
  modules: ["@wxt-dev/module-react"],
  // Imports are explicit (`wxt/browser`, `wxt/utils/...`) so Biome and
  // fallow can follow them.
  imports: false,
  // A function, so every build step (one per entrypoint group) gets fresh
  // plugin instances. Same Tailwind and React Compiler setup as apps/web.
  vite: () => ({
    envDir: repoRoot,
    plugins: [tailwindcss(), babel({ presets: [reactCompilerPreset()] })],
  }),
  manifest: ({ manifestVersion }) => ({
    name: "SchnellBuch",
    description:
      "Save the page you're on, or any link, to SchnellBuch, and import this browser's bookmarks.",
    permissions: [
      "activeTab",
      "bookmarks",
      "contextMenus",
      "scripting",
      "storage",
    ],
    host_permissions: [serverMatchPattern(buildEnv.WXT_SCHNELLBUCH_URL)],
    ...(manifestVersion === 2
      ? { optional_permissions: ANY_WEB_PAGE }
      : { optional_host_permissions: ANY_WEB_PAGE }),
    action: { default_title: "Save to SchnellBuch" },
    commands: {
      "save-page": {
        suggested_key: { default: "Alt+Shift+S" },
        description: "Save this page to SchnellBuch",
      },
    },
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    browser_specific_settings: {
      gecko: { id: "schnellbuch@schnellbuch.extension" },
    },
  }),
});
