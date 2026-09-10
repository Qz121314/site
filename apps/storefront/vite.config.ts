import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/go': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/pages': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/public': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/_media': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/_image': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/manifest.webmanifest': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/robots.txt': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
