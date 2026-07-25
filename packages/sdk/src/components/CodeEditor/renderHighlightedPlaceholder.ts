import { javascript } from '@codemirror/lang-javascript';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { CodeEditorTheme } from '../../types.js';
import { createBuiltInSyntaxHighlighting } from './editorChrome.js';
import { type SlashCommandSpec, createSlashCommandHighlighter } from './slashCommandHighlighter.js';
import { getCodeEditorThemeExtension } from './themes.js';

/**
 * Inputs for rendering a muted syntax-highlighted placeholder document.
 */
export interface RenderHighlightedPlaceholderOptions {
  /**
   * Normalized CSS font size matching the parent editor.
   */
  fontSize: string;

  /**
   * Whether the host prefers dark mode.
   */
  isDark: boolean;

  /**
   * Persisted CodeMirror theme selection.
   */
  theme: CodeEditorTheme;

  /**
   * Optional slash commands to highlight inside the placeholder document.
   */
  slashCommands?: SlashCommandSpec[];
}

const renderCache = new Map<string, HTMLElement>();

/**
 * Builds a stable cache key for rendered placeholder DOM.
 *
 * @param text - Placeholder source text.
 * @param options - Theme and highlighting options.
 */
function buildRenderCacheKey(text: string, options: RenderHighlightedPlaceholderOptions): string {
  const slashNames = options.slashCommands?.map((command) => command.name).join(',') ?? '';
  return [text, options.fontSize, String(options.isDark), options.theme, slashNames].join('\0');
}

/**
 * Builds CodeMirror extensions for the offscreen placeholder render pass.
 *
 * @param options - Theme and highlighting options.
 */
function buildOffscreenPlaceholderExtensions(
  options: RenderHighlightedPlaceholderOptions
): Extension[] {
  const extensions: Extension[] = [
    javascript(),
    EditorView.lineWrapping,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    EditorView.theme({
      '&': { backgroundColor: 'transparent' },
      '.cm-scroller': { overflow: 'hidden' },
      '.cm-content': {
        padding: '0',
        fontFamily: 'var(--font-mono)',
        fontSize: options.fontSize
      },
      '.cm-line': { padding: '0' },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '.cm-slash-command': {
        color: 'var(--mac-accent)'
      },
      '.cm-slash-command-args': {
        color: 'var(--mac-muted)',
        fontStyle: 'italic'
      }
    })
  ];

  const themeExtension = getCodeEditorThemeExtension(options.theme);
  if (themeExtension) {
    extensions.push(themeExtension);
  } else {
    extensions.push(createBuiltInSyntaxHighlighting(options.isDark));
  }

  if (options.slashCommands && options.slashCommands.length > 0) {
    extensions.push(createSlashCommandHighlighter(options.slashCommands));
  }

  return extensions;
}

/**
 * Renders highlighted placeholder markup via a hidden offscreen editor, then clones
 * the resulting line nodes into a flat inline placeholder element.
 *
 * @param text - Placeholder source shown until the user focuses or types.
 * @param options - Highlighting and theme options shared with the parent editor.
 */
export function renderHighlightedPlaceholderDom(
  text: string,
  options: RenderHighlightedPlaceholderOptions
): HTMLElement {
  const cacheKey = buildRenderCacheKey(text, options);
  const cached = renderCache.get(cacheKey);
  if (cached) {
    return cached.cloneNode(true) as HTMLElement;
  }

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;';
  document.body.appendChild(host);

  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: buildOffscreenPlaceholderExtensions(options)
    }),
    parent: host
  });

  const wrap = document.createElement('span');
  wrap.className = 'cm-placeholder cm-syntax-placeholder';
  wrap.style.pointerEvents = 'none';
  wrap.style.display = 'inline-block';
  wrap.style.verticalAlign = 'top';
  wrap.style.whiteSpace = 'pre-wrap';
  wrap.style.opacity = '0.55';
  wrap.style.fontFamily = 'var(--font-mono)';
  wrap.style.fontSize = options.fontSize;
  wrap.style.userSelect = 'none';
  wrap.style.width = '100%';
  wrap.setAttribute('aria-hidden', 'true');

  const content = view.dom.querySelector('.cm-content');
  if (content) {
    for (const line of content.querySelectorAll('.cm-line')) {
      wrap.appendChild(line.cloneNode(true));
    }
  }

  view.destroy();
  host.remove();

  renderCache.set(cacheKey, wrap.cloneNode(true) as HTMLElement);
  return wrap;
}
