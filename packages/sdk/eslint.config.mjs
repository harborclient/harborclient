import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules', '**/dist', 'src/runtime/**', 'scripts/**', 'docs/**']
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier
);
