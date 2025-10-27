import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
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
  plugins: [react(), crx({ manifest }), fixHMRPortPlugin()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
