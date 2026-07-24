import tseslint from '@electron-toolkit/eslint-config-ts';
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      'docs/**',
      'scripts/**',
      // Accidental tsc emit next to sources — real sources are *.ts only.
      'src/**/*.js',
      'src/**/*.d.ts'
    ]
  },
  tseslint.configs.recommended,
  eslintConfigPrettier
);
