import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Plugin, mergeConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const srcDir = join(projectRoot, 'src');

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

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      base: configType === 'PRODUCTION' ? '/harborclient/sdk/storybook/' : config.base,
      plugins: [tailwindcss(), resolveSourceJsToTsx()],
      resolve: {
        alias: {
          '@harborclient/sdk/react': join(srcDir, 'runtime/react.js'),
          '@harborclient/sdk/react-dom': join(srcDir, 'runtime/react-dom.js'),
          '@harborclient/sdk/jsx-runtime': join(srcDir, 'runtime/jsx-runtime.js'),
          '@harborclient/sdk/jsx-dev-runtime': join(srcDir, 'runtime/jsx-dev-runtime.js'),
          '@harborclient/sdk': join(srcDir, 'runtime/index.js')
        }
      }
    });
  }
};

export default config;
