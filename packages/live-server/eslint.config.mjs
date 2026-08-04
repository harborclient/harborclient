import tseslint from '@electron-toolkit/eslint-config-ts';
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/node_modules', '**/dist', '**/out', 'docs/**', 'scripts/**']
  },
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  eslintConfigPrettier
);
