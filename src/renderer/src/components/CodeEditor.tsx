import { autocompletion } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  hoverTooltip,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { tags } from '@lezer/highlight';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { CodeEditorSetup, CodeEditorTheme, ScriptPhase, Variable } from '#/shared/types';
import { getCodeEditorThemeExtension } from '#/renderer/src/components/codeEditorThemes';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectCodeEditorSetup,
  selectCodeEditorTheme
} from '#/renderer/src/store/slices/settingsSlice';
import { resolveVariable } from '#/renderer/src/store';
import { createHcCompletionSource } from '#/renderer/src/scripting/hcCompletions';

export type CodeEditorLanguage = 'json' | 'text' | 'javascript';

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

  /**
   * Collection-scoped variables for {{token}} highlighting and tooltips.
   */
  variables?: Variable[];

  /**
   * Opens collection settings to edit a hovered variable.
   */
  onEditVariable?: () => void;

  /**
   * When set on a JavaScript editor, enables hc API autocomplete for pre/post scripts.
   */
  scriptPhase?: ScriptPhase;

  /**
   * When set, overrides the persisted CodeMirror theme (used by the settings preview).
   */
  themeOverride?: CodeEditorTheme;

  /**
   * When set, overrides persisted basicSetup options (used by the settings preview).
   */
  setupOverride?: CodeEditorSetup;
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
  },
  '.cm-variable-token': {
    color: '#32D2E2'
  },
  '.cm-tooltip.cm-tooltip-hover': {
    border: '1px solid var(--mac-separator)',
    backgroundColor: 'var(--mac-surface)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  },
  '.cm-variable-tooltip': {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--mac-text)'
  },
  '.cm-variable-tooltip-muted': {
    color: 'var(--mac-muted)'
  },
  '.cm-variable-tooltip-edit': {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--mac-accent)'
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid var(--mac-separator)',
    backgroundColor: 'var(--mac-surface)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: '12px'
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

const variableMatcher = new MatchDecorator({
  regexp: /\{\{\s*([\w.-]+)\s*\}\}/g,
  decoration: Decoration.mark({ class: 'cm-variable-token' })
});

const variableHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    /**
     * Builds the initial {{variable}} decoration set for the editor view.
     *
     * @param view - CodeMirror editor view instance.
     */
    constructor(view: EditorView) {
      this.decorations = variableMatcher.createDeco(view);
    }

    /**
     * Recomputes decorations when document content or viewport changes.
     *
     * @param update - View update describing what changed.
     */
    update(update: ViewUpdate): void {
      this.decorations = variableMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

/**
 * Builds a hover tooltip extension for {{variable}} tokens.
 *
 * @param variables - Collection-scoped variables for resolution.
 * @param onEditVariable - Optional callback to open collection settings.
 */
function variableTooltip(
  variables: Variable[],
  onEditVariable?: () => void
): ReturnType<typeof hoverTooltip> {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const pattern = /\{\{\s*([\w.-]+)\s*\}\}/g;

    for (const match of line.text.matchAll(pattern)) {
      const start = line.from + (match.index ?? 0);
      const end = start + match[0].length;
      if (pos < start || pos > end) continue;

      const value = resolveVariable(match[1], variables);
      return {
        pos: start,
        end,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-variable-tooltip';

          const valueEl = document.createElement('div');
          valueEl.textContent = value ?? 'Not defined';
          if (value === undefined) {
            valueEl.className = 'cm-variable-tooltip-muted';
          }
          dom.appendChild(valueEl);

          if (onEditVariable) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Edit value';
            btn.className = 'cm-variable-tooltip-edit';
            btn.addEventListener('mousedown', (e) => {
              e.preventDefault();
              onEditVariable();
            });
            dom.appendChild(btn);
          }

          return { dom };
        }
      };
    }

    return null;
  });
}

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
  className = '',
  variables,
  onEditVariable,
  scriptPhase,
  themeOverride,
  setupOverride
}: Props): JSX.Element {
  const storeTheme = useAppSelector(selectCodeEditorTheme);
  const storeSetup = useAppSelector(selectCodeEditorSetup);
  const resolvedTheme = themeOverride ?? storeTheme;
  const resolvedSetup = setupOverride ?? (readOnly ? null : storeSetup);
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  /**
   * Tracks system dark mode so syntax highlighting matches the active theme.
   */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => setIsDark(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  /**
   * Assembles CodeMirror extensions for language mode, theme, and optional variable tooling.
   */
  const extensions = useMemo(() => {
    const next = [EditorView.lineWrapping, editorTheme];
    const themeExtension = getCodeEditorThemeExtension(resolvedTheme);
    if (themeExtension) {
      next.push(themeExtension);
    } else {
      next.push(syntaxHighlighting(isDark ? darkHighlight : lightHighlight));
    }
    if (language === 'json') {
      next.push(json());
    }
    if (language === 'javascript') {
      next.push(javascript());
      if (scriptPhase) {
        next.push(
          autocompletion({
            activateOnTyping: true,
            override: [createHcCompletionSource(scriptPhase, variables ?? [])]
          })
        );
      }
    }
    if (variables) {
      next.push(variableHighlighter, variableTooltip(variables, onEditVariable));
    }
    return next;
  }, [resolvedTheme, isDark, language, variables, onEditVariable, scriptPhase]);

  /**
   * Resolves CodeMirror basicSetup from persisted settings or read-only defaults.
   */
  const basicSetup = useMemo(() => {
    if (!resolvedSetup) {
      return {
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        autocompletion: false,
        closeBrackets: false,
        indentOnInput: false
      };
    }

    if (readOnly) {
      return {
        lineNumbers: resolvedSetup.lineNumbers,
        foldGutter: resolvedSetup.foldGutter,
        highlightActiveLine: resolvedSetup.highlightActiveLine,
        highlightActiveLineGutter: resolvedSetup.highlightActiveLineGutter,
        highlightSelectionMatches: false,
        autocompletion: false,
        closeBrackets: false,
        indentOnInput: false
      };
    }

    return {
      lineNumbers: resolvedSetup.lineNumbers,
      foldGutter: resolvedSetup.foldGutter,
      highlightActiveLine: resolvedSetup.highlightActiveLine,
      highlightActiveLineGutter: resolvedSetup.highlightActiveLineGutter
    };
  }, [resolvedSetup, readOnly]);

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
        basicSetup={basicSetup}
      />
    </div>
  );
}
