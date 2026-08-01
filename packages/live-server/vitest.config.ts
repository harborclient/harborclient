import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@harborclient\/core\/(.*)/,
        replacement: `${fileURLToPath(new URL('../core/src', import.meta.url))}/$1`
      },
      {
        find: '@harborclient/core',
        replacement: fileURLToPath(new URL('../core/src', import.meta.url))
      },
      {
        find: /^@harborclient\/sdk\/(.*)/,
        replacement: `${fileURLToPath(new URL('../sdk/src', import.meta.url))}/$1`
      },
      {
        find: '@harborclient/sdk',
        replacement: fileURLToPath(new URL('../sdk/src', import.meta.url))
      }
    ]
  },
  test: {
    include: ['src/**/*.test.ts']
  }
});
