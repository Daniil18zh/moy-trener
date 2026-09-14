/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // "/" for local dev and any root-domain host. GitHub Pages serves the app from
  // https://<user>.github.io/<repo>/, so deploy with VITE_BASE_PATH=/<repo>/ npm run build —
  // no code change needed, because every runtime asset path goes through import.meta.env.BASE_URL.
  base: process.env.VITE_BASE_PATH || '/',
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/vendor/**'],
  },
});
