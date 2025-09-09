import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    /** distは手動で削除すること */
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.ts"),
        background: resolve(__dirname, "src/background.ts"),
        dashboard: resolve(__dirname, "src/dashboard.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
