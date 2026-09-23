import { defineConfig } from 'vite';

// `base` is relative so the built bundle works from a repository subpath
// (GitHub Pages) and from a plain static host without changes.
export default defineConfig({
  base: './',
  define: {
    global: 'globalThis',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
