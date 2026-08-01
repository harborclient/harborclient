import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@harborclient/core',
        replacement: fileURLToPath(new URL('../../packages/core/src', import.meta.url))
      },
      {
        find: '@harborclient/live-server',
        replacement: fileURLToPath(new URL('../../packages/live-server/src', import.meta.url))
      },
      {
        find: '@harborclient/storage-sqlite',
        replacement: fileURLToPath(new URL('../../packages/storage-sqlite/src', import.meta.url))
      }
    ]
  },
  test: {
    include: ['src/**/*.test.ts']
  }
});
