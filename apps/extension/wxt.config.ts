import { defineConfig } from "wxt";

export default defineConfig({
  // Imports are explicit (`wxt/browser`, `wxt/utils/...`) so Biome and
  // fallow can follow them.
  imports: false,
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
