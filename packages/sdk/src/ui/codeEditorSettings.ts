import type { CodeEditorSetup, CodeEditorTheme } from '../types.js';

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
 * Default editor font size applied when no valid value is stored.
 */
export const DEFAULT_CODE_EDITOR_FONT_SIZE = '16px';

/**
 * Minimum allowed editor font size in pixels (HarborClient UI accessibility floor).
 */
export const MIN_CODE_EDITOR_FONT_SIZE_PX = 14;

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

/**
 * Parses a raw font size into pixel units, clamping below the minimum.
 *
 * @param value - Raw font size from storage, props, or user input.
 * @returns Normalized CSS length such as `16px`.
 */
export function normalizeCodeEditorFontSize(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clamped = Math.max(MIN_CODE_EDITOR_FONT_SIZE_PX, Math.round(value));
    return `${clamped}px`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const pxMatch = trimmed.match(/^(\d+(?:\.\d+)?)px$/i);
    if (pxMatch) {
      const parsed = Number(pxMatch[1]);
      if (Number.isFinite(parsed)) {
        const clamped = Math.max(MIN_CODE_EDITOR_FONT_SIZE_PX, Math.round(parsed));
        return `${clamped}px`;
      }
    }

    const integerMatch = trimmed.match(/^(\d+)$/);
    if (integerMatch) {
      const parsed = Number(integerMatch[1]);
      if (Number.isFinite(parsed)) {
        const clamped = Math.max(MIN_CODE_EDITOR_FONT_SIZE_PX, parsed);
        return `${clamped}px`;
      }
    }
  }

  return DEFAULT_CODE_EDITOR_FONT_SIZE;
}
