import type { CodeEditorSetup, CodeEditorTheme } from '#/shared/types';

/**
 * Valid CodeMirror theme identifiers for settings validation.
 */
export const CODE_EDITOR_THEME_IDS = [
  'default',
  'dracula',
  'githubLight',
  'githubDark',
  'monokai',
  'nord',
  'solarizedLight',
  'tokyoNight'
] as const satisfies readonly CodeEditorTheme[];

/**
 * Default CodeMirror basicSetup options for editable editors.
 */
export const DEFAULT_CODE_EDITOR_SETUP: CodeEditorSetup = {
  lineNumbers: true,
  foldGutter: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true
};

/**
 * Returns true when the value is a known CodeMirror theme identifier.
 *
 * @param value - Raw theme value from storage or input.
 */
export function isCodeEditorTheme(value: unknown): value is CodeEditorTheme {
  return typeof value === 'string' && (CODE_EDITOR_THEME_IDS as readonly string[]).includes(value);
}

/**
 * Normalizes a CodeEditorSetup object with defaults for invalid fields.
 *
 * @param input - Raw setup from storage or user input.
 * @returns Normalized setup flags.
 */
export function normalizeCodeEditorSetup(
  input: Partial<CodeEditorSetup> | undefined
): CodeEditorSetup {
  return {
    lineNumbers: input?.lineNumbers !== false,
    foldGutter: input?.foldGutter !== false,
    highlightActiveLine: input?.highlightActiveLine !== false,
    highlightActiveLineGutter: input?.highlightActiveLineGutter !== false
  };
}

/**
 * Normalizes a theme identifier, falling back to default when unknown.
 *
 * @param value - Raw theme value from storage or input.
 */
export function normalizeCodeEditorTheme(value: unknown): CodeEditorTheme {
  return isCodeEditorTheme(value) ? value : 'default';
}
