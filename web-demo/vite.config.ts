import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5173,
    headers: {
      // Enable SharedArrayBuffer
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    fs: {
      // Allow serving artifacts from parent directory
      allow: ['.', '../artifacts']
    }
  },
  resolve: {
    alias: {
      '@druos/runtime': path.resolve(__dirname, '../packages/runtime-sdk/src'),
      '@druos/device-protocols': path.resolve(__dirname, '../packages/device-protocols/src')
    }
  }
});
