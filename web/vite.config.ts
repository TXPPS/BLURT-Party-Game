import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': `${repoRoot}shared`,
      '@content': `${repoRoot}content`,
    },
  },
  server: {
    port: 5173,
    // The Worker owns /ws and /api in production too, so dev matches production
    // routing exactly and there is no CORS anywhere in the project.
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    // Budget: < 250 KB gzipped initial. Anything past this is a build warning, and
    // the crude pack / canvas / results sequence are code-split to stay under it.
    chunkSizeWarningLimit: 260,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
