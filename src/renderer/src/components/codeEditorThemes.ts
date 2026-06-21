import type { Extension } from '@codemirror/state';
import {
  dracula,
  githubDark,
  githubLight,
  monokai,
  nord,
  solarizedLight,
  tokyoNight
} from '@uiw/codemirror-themes-all';
import type { CodeEditorTheme } from '#/shared/types';

export { CODE_EDITOR_THEME_IDS } from '#/shared/codeEditorSettings';

/**
 * Theme options shown in the syntax highlighting settings dropdown.
 */
export const CODE_EDITOR_THEME_OPTIONS: Array<{ value: CodeEditorTheme; label: string }> = [
  { value: 'default', label: 'Default (built-in)' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'githubLight', label: 'GitHub Light' },
  { value: 'githubDark', label: 'GitHub Dark' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'nord', label: 'Nord' },
  { value: 'solarizedLight', label: 'Solarized Light' },
  { value: 'tokyoNight', label: 'Tokyo Night' }
];

const themeExtensions: Record<Exclude<CodeEditorTheme, 'default'>, Extension> = {
  dracula,
  githubLight,
  githubDark,
  monokai,
  nord,
  solarizedLight,
  tokyoNight
};

/**
 * Returns the CodeMirror theme extension for a settings value, or null for the built-in look.
 *
 * @param value - Persisted or selected theme identifier.
 * @returns Theme extension to append to the editor, or null when using built-in highlighting.
 */
export function getCodeEditorThemeExtension(value: CodeEditorTheme): Extension | null {
  if (value === 'default') {
    return null;
  }
  return themeExtensions[value];
}
