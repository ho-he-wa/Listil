import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: "dist/js",
    emptyOutDir: true, // distを毎回クリア
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'src/popup.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        dashboard: resolve(__dirname, 'src/dashboard.ts'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
