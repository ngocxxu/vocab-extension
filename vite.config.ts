import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./manifest.config";
import type { Plugin } from "vite";

const fixHMRPortPlugin = (): Plugin => {
  return {
    name: "fix-hmr-port-error",
    apply: "serve",
    transform(code, id) {
      if (id.includes("crx-client-port") && !id.includes("node_modules")) {
        const fixed = code.replace(
          /} else\s+throw error;/g,
          `} else {
          console.warn("[HMR] Port error:", error);
        }`
        );
        if (fixed !== code) {
          return { code: fixed, map: null };
        }
      }
      return null;
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest }), fixHMRPortPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "src/popup/index.html"),
        options: path.resolve(__dirname, "src/options/index.html"),
        oauthCallback: path.resolve(__dirname, "src/oauth-callback/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
