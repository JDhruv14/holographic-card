import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        charizard: resolve(import.meta.dirname, 'examples/charizard/index.html'),
      },
    },
  },
});
