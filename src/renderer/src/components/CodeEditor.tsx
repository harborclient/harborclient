import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { tags } from '@lezer/highlight';
import { useEffect, useMemo, useState, type JSX } from 'react';

export type CodeEditorLanguage = 'json' | 'text';

interface Props {
  /**
   * Editor content.
   */
  value: string;

  /**
   * Called when the user edits the content; omitted for read-only views.
   *
   * @param value - Updated editor content.
   */
  onChange?: (value: string) => void;

  /**
   * Syntax mode for highlighting.
   */
  language?: CodeEditorLanguage;

  /**
   * When true, the editor cannot be edited.
   */
  readOnly?: boolean;

  /**
   * Placeholder shown when the editor is empty.
   */
  placeholder?: string;

  /**
   * Minimum editor height in CSS units.
   */
  minHeight?: string;

  /**
   * Additional wrapper classes.
   */
  className?: string;
}

const lightHighlight = HighlightStyle.define([
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

const darkHighlight = HighlightStyle.define([
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

const editorTheme = EditorView.theme({
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
    fontSize: '12px',
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
  }
});

/**
 * CodeMirror wrapper for editable request bodies and read-only response views.
 */
export function CodeEditor({
  value,
  onChange,
  language = 'text',
  readOnly = false,
  placeholder,
  minHeight = '144px',
  className = ''
}: Props): JSX.Element {
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => setIsDark(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const extensions = useMemo(() => {
    const next = [
      EditorView.lineWrapping,
      editorTheme,
      syntaxHighlighting(isDark ? darkHighlight : lightHighlight)
    ];
    if (language === 'json') {
      next.push(json());
    }
    return next;
  }, [isDark, language]);

  const wrapperClassName = readOnly
    ? `overflow-hidden rounded-md bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag ${className}`
    : `min-h-36 resize-y overflow-hidden rounded-md border border-separator bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--mac-accent)_35%,transparent),inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag ${className}`;

  return (
    <div className={wrapperClassName}>
      <CodeMirror
        value={value}
        onChange={readOnly ? undefined : onChange}
        extensions={extensions}
        theme="none"
        editable={!readOnly}
        readOnly={readOnly}
        placeholder={placeholder}
        minHeight={minHeight}
        basicSetup={
          readOnly
            ? {
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                highlightSelectionMatches: false,
                autocompletion: false,
                closeBrackets: false,
                indentOnInput: false
              }
            : {
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true
              }
        }
      />
    </div>
  );
}
