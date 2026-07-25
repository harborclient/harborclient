/**
 * Vitest config for @harborclient/sdk.
 *
 * Resolves the same aliases Jest used (`@harborclient/sdk/react` → `react`) and
 * reuses Storybook's `.js` → `.ts`/`.tsx` resolution so relative ESM imports in
 * source files work under Vite without rewriting extensionless paths.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Resolves relative `.js` imports to colocated `.ts` / `.tsx` sources.
 *
 * @returns Vite plugin used by Vitest and Storybook.
 */
function resolveSourceJsToTsx(): Plugin {
  return {
    name: 'resolve-source-js-to-tsx',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.endsWith('.js')) {
        return null;
      }

      const base = source.startsWith('.') ? resolve(dirname(importer), source) : source;
      const candidates = [`${base.slice(0, -3)}.tsx`, `${base.slice(0, -3)}.ts`];

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return candidate;
        }
      }

      return null;
    }
  };
}

export default defineConfig({
  plugins: [resolveSourceJsToTsx()],
  resolve: {
    alias: {
      '@harborclient/sdk/react': 'react'
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.js']
  }
});
