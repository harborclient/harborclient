import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Prec, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/** Font size for fenced code blocks inside markdown documents. */
const MARKDOWN_CODE_FONT_SIZE = '14px';

/**
 * Built-in dark syntax colors aligned with HarborClient CodeEditor defaults.
 */
const markdownDarkHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: '#ff7ab2' },
  { tag: tags.string, color: '#ff8170' },
  { tag: tags.number, color: '#78dce8' },
  { tag: tags.bool, color: '#78dce8' },
  { tag: tags.null, color: '#78dce8' },
  { tag: tags.keyword, color: '#ff7ab2' },
  { tag: tags.bracket, color: 'var(--mac-text)' },
  { tag: tags.punctuation, color: 'var(--mac-muted)' },
  { tag: tags.comment, color: 'var(--mac-muted)', fontStyle: 'italic' }
]);

/**
 * CodeMirror chrome for markdown fenced blocks in dark appearance mode.
 *
 * Uses `--mac-sidebar` so interactive blocks match static `<pre>` styling.
 */
function createMarkdownCodeMirrorChromeTheme(): Extension {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'var(--mac-sidebar)',
        color: 'var(--mac-text)'
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono)'
      },
      '.cm-content': {
        padding: '8px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: MARKDOWN_CODE_FONT_SIZE,
        caretColor: 'var(--mac-accent)'
      },
      '.cm-line': {
        padding: '0 8px'
      },
      '&.cm-focused': {
        outline: 'none'
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--mac-accent)'
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--mac-selection) !important'
      },
      '.cm-gutters': {
        backgroundColor: 'color-mix(in srgb, var(--mac-sidebar) 85%, var(--mac-text))',
        color: 'var(--mac-muted)',
        border: 'none'
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--mac-selection)'
      },
      '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--mac-selection) 45%, transparent)'
      }
    },
    { dark: true }
  );
}

/**
 * Returns CodeMirror extensions that override MDXEditor's hardcoded light theme
 * when the app appearance is dark.
 *
 * MDXEditor always appends `basicLight` after custom extensions; `Prec.highest`
 * ensures HarborClient dark chrome and syntax win regardless of array order.
 *
 * @param isDark - Whether the active appearance theme is dark.
 * @returns Theme override extensions, or an empty array for light appearance.
 */
export function createMarkdownCodeMirrorThemeExtensions(isDark: boolean): Extension[] {
  if (!isDark) {
    return [];
  }

  return [
    Prec.highest([createMarkdownCodeMirrorChromeTheme(), syntaxHighlighting(markdownDarkHighlight)])
  ];
}
