import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Vocab Manager",
  version: "1.0.0",
  description: "Save vocabulary from any webpage with a right-click",
  permissions: [
    "storage",
    "contextMenus",
    "notifications",
    "activeTab",
    "tabs",
  ],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/index.ts",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
    },
  ],
  action: {
    default_popup: "src/popup/index.html",
    default_icon: "icons/icon128.png",
  },
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  options_page: "src/options/index.html",
});
