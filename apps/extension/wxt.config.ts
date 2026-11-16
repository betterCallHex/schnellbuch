import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

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
    envDir: fileURLToPath(new URL("../..", import.meta.url)),
    plugins: [tailwindcss(), babel({ presets: [reactCompilerPreset()] })],
  }),
  manifest: {
    name: "SchnellBuch",
    description: "Save the page you're on, or any link, to SchnellBuch.",
    permissions: ["activeTab", "contextMenus", "storage"],
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
  },
});
