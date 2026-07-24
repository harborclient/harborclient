import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#\/test\//,
        replacement: `${fileURLToPath(new URL('../../apps/gui/src/test/', import.meta.url))}/`
      },
      {
        find: /^#\//,
        replacement: `${fileURLToPath(new URL('./src/', import.meta.url))}/`
      },
      {
        find: '@harborclient/core',
        replacement: fileURLToPath(new URL('../core/src', import.meta.url))
      }
    ]
  },
  test: {
    include: ['src/**/*.test.ts']
  }
});
