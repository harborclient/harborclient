import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
      '@harborclient/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/vitest.setup.ts']
  }
});
