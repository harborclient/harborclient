import type { CodeEditorSetup } from '#/shared/types';

/**
 * Sample JavaScript shown in the syntax highlighting preview editor.
 */
export const PREVIEW_SAMPLE = `const response = hc.response.json();
console.log(response);
if (response.idToken) {
    hc.collection.variables.set('idToken', response.idToken);
}`;

/**
 * Checkbox options for CodeMirror editor setup toggles.
 */
export const SETUP_OPTIONS: Array<{ key: keyof CodeEditorSetup; label: string }> = [
  { key: 'lineNumbers', label: 'Line numbers' },
  { key: 'foldGutter', label: 'Code folding gutter' },
  { key: 'highlightActiveLine', label: 'Highlight active line' },
  { key: 'highlightActiveLineGutter', label: 'Highlight active line gutter' }
];
