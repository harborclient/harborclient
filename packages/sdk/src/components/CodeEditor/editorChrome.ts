import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/**
 * Built-in light syntax colors when no third-party CodeMirror theme is selected.
 */
export const lightHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: '#881391' },
  { tag: tags.string, color: '#c41a16' },
  { tag: tags.number, color: '#1c00cf' },
  { tag: tags.bool, color: '#1c00cf' },
  { tag: tags.null, color: '#1c00cf' },
  { tag: tags.keyword, color: '#881391' },
  { tag: tags.bracket, color: 'var(--mac-text)' },
  { tag: tags.punctuation, color: 'var(--mac-muted)' },
  { tag: tags.comment, color: 'var(--mac-muted)', fontStyle: 'italic' }
]);

/**
 * Built-in dark syntax colors when no third-party CodeMirror theme is selected.
 */
export const darkHighlight = HighlightStyle.define([
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
 * Builds CodeMirror chrome styles for the resolved editor font size.
 *
 * @param fontSize - Normalized CSS font size such as `16px`.
 */
export function createEditorTheme(fontSize: string): ReturnType<typeof EditorView.theme> {
  return EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--mac-text)'
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'var(--font-mono)'
    },
    '.cm-content': {
      padding: '8px 0',
      fontFamily: 'var(--font-mono)',
      fontSize,
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
      backgroundColor: 'transparent',
      color: 'var(--mac-muted)',
      border: 'none'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--mac-selection)'
    },
    '.cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, var(--mac-selection) 45%, transparent)'
    },
    '.cm-variable-token': {
      color: '#32D2E2'
    },
    '.cm-slash-command': {
      color: 'var(--mac-accent)'
    },
    '.cm-slash-command-args': {
      color: 'var(--mac-muted)',
      fontStyle: 'italic'
    },
    '.cm-tooltip.cm-tooltip-hover': {
      border: '1px solid var(--mac-separator)',
      backgroundColor: 'var(--mac-surface)',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    },
    '.cm-tooltip-lint .cm-diagnosticAction': {
      display: 'inline-flex',
      alignItems: 'center',
      marginTop: '6px',
      borderRadius: '6px',
      border: '1px solid var(--mac-separator)',
      backgroundColor: 'var(--mac-control)',
      padding: '4px 8px',
      fontSize: '14px',
      color: 'var(--mac-text)',
      cursor: 'pointer'
    },
    '.cm-tooltip-lint .cm-diagnosticAction:hover': {
      backgroundColor: 'var(--mac-selection)'
    },
    '.cm-variable-tooltip': {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '8px 12px',
      fontSize: '16px',
      color: 'var(--mac-text)'
    },
    '.cm-variable-tooltip-value-row': {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    '.cm-variable-tooltip-value': {
      boxSizing: 'border-box',
      flex: '1 1 0%',
      minWidth: '0',
      borderRadius: '8px',
      border: '1px solid var(--mac-separator)',
      backgroundColor: 'var(--mac-field)',
      padding: '6px 10px',
      fontSize: '16px',
      color: 'var(--mac-text)',
      cursor: 'default'
    },
    '.cm-variable-tooltip-value-muted': {
      color: 'var(--mac-muted)'
    },
    '.cm-variable-tooltip-copy': {
      display: 'inline-flex',
      flexShrink: '0',
      alignItems: 'center',
      justifyContent: 'center',
      width: '30px',
      height: '30px',
      borderRadius: '9999px',
      border: 'none',
      backgroundColor: 'transparent',
      color: 'var(--mac-muted)',
      cursor: 'pointer'
    },
    '.cm-variable-tooltip-copy:hover': {
      backgroundColor: 'var(--mac-selection)',
      color: 'var(--mac-text)'
    },
    '.cm-variable-tooltip-copy-icon': {
      display: 'block'
    },
    '.cm-variable-tooltip-edit': {
      alignSelf: 'flex-start',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '32px',
      borderRadius: '9999px',
      border: '1px solid var(--mac-separator)',
      backgroundColor: 'var(--mac-control)',
      padding: '4px 12px',
      fontSize: '15px',
      color: 'var(--mac-text)',
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    },
    '.cm-variable-tooltip-edit:hover': {
      backgroundColor: 'var(--mac-selection)'
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      border: '1px solid var(--mac-separator)',
      backgroundColor: 'var(--mac-surface)',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontSize
    },
    '.cm-completionLabel': {
      fontFamily: 'var(--font-mono)'
    },
    '.cm-completionDetail': {
      color: 'var(--mac-muted)',
      fontStyle: 'normal',
      marginLeft: '8px'
    }
  });
}

/**
 * Returns built-in syntax highlighting for the active system color scheme.
 *
 * @param isDark - Whether the host prefers dark mode.
 */
export function createBuiltInSyntaxHighlighting(
  isDark: boolean
): ReturnType<typeof syntaxHighlighting> {
  return syntaxHighlighting(isDark ? darkHighlight : lightHighlight);
}
