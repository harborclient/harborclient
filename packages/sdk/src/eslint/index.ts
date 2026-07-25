import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared flat ESLint config for HarborClient plugins (ESLint 10 compatible).
 *
 * Plugins re-export this from `eslint.config.mjs`:
 * `export { default } from '@harborclient/sdk/eslint';`
 */
export default tseslint.config(
  {
    ignores: ['**/node_modules', '**/dist', 'pnpm-lock.yaml']
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.node
    }
  },
  eslintConfigPrettier
);
