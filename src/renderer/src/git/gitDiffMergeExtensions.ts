import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { CodeEditorLanguage } from '@harborclient/sdk/components';
import { inferGitDiffLanguage } from '#/renderer/src/git/parseGitDiffFile';

/**
 * Syntax colors aligned with HarborClient CodeEditor defaults.
 */
const gitDiffHighlight = HighlightStyle.define([
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
 * CodeMirror chrome for read-only git merge panes.
 */
function createGitDiffMergeChromeTheme(): Extension {
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
        fontSize: '14px'
      },
      '.cm-line': {
        padding: '0 8px'
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
 * Returns the language parser extension for one git diff syntax mode.
 *
 * @param language - Supported CodeEditor language for the changed file.
 */
function languageExtensionFor(language: CodeEditorLanguage): Extension {
  if (language === 'json') {
    return json();
  }

  if (language === 'javascript') {
    return javascript();
  }

  if (language === 'shell') {
    return StreamLanguage.define(shell);
  }

  return [];
}

/**
 * Builds read-only CodeMirror extensions for one side of a git merge view.
 *
 * @param language - Syntax mode inferred from the changed file path.
 * @param ariaLabel - Accessible name for the pane content.
 */
export function createGitDiffMergeExtensions(
  language: CodeEditorLanguage,
  ariaLabel: string
): Extension[] {
  return [
    lineNumbers(),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
    languageExtensionFor(language),
    createGitDiffMergeChromeTheme(),
    syntaxHighlighting(gitDiffHighlight)
  ];
}

/**
 * Resolves merge-view syntax extensions from a repository-relative file path.
 *
 * @param path - Repository-relative path under the HarborClient tree.
 * @param ariaLabel - Accessible name for the pane content.
 */
export function createGitDiffMergeExtensionsForPath(path: string, ariaLabel: string): Extension[] {
  return createGitDiffMergeExtensions(inferGitDiffLanguage(path), ariaLabel);
}
