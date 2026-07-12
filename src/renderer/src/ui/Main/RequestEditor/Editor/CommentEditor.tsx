import {
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  codeBlockPlugin,
  codeMirrorPlugin
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { Variable } from '#/shared/types';
import { useCallback, useEffect, useMemo, useRef, type JSX, type ReactNode } from 'react';
import { FormGroup } from '@harborclient/sdk/components';

import { useAppDispatch } from '#/renderer/src/store/hooks';
import { clipboardHasRichHtml, shouldParsePasteAsMarkdown } from './pasteMarkdownUtils';
import { formatMarkdown } from './formatMarkdown';
import { useMarkdownCodeMirrorTheme } from './useMarkdownCodeMirrorTheme';
import { variableHighlightPlugin } from './variableHighlightPlugin';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';

/** Languages offered in fenced code blocks inside request comments. */
const CODE_BLOCK_LANGUAGES: Record<string, string> = {
  js: 'JavaScript',
  json: 'JSON',
  ts: 'TypeScript',
  bash: 'Bash',
  css: 'CSS',
  html: 'HTML'
};

interface Props {
  /**
   * Current markdown comment stored on the request draft.
   */
  value: string;

  /**
   * Called when the user edits the comment markdown.
   *
   * @param comment - Updated markdown string.
   */
  onChange: (comment: string) => void;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;

  /**
   * Accessible label for the editor group; defaults to "Comment".
   */
  label?: string;

  /**
   * Helper text shown below the label.
   */
  description?: string;

  /**
   * Optional controls rendered on the right side of the header row (e.g. Save).
   */
  actions?: ReactNode;

  /**
   * When true, marks this editor as a collection markdown document so the
   * context menu offers Format Document and listens for that menu action.
   */
  enableFormatDocument?: boolean;
}

/** Selector for the MDXEditor scroll container inside the comment editor shell. */
const COMMENT_EDITOR_SCROLL_ROOT = '.mdxeditor-root-contenteditable';

/** Selector for the Lexical contenteditable surface. */
const COMMENT_EDITOR_CONTENT = '.request-comment-editor-content';

/**
 * Returns whether a viewport Y coordinate is below the last top-level block in the editor.
 *
 * @param editable - Lexical contenteditable root element.
 * @param clientY - Pointer Y position in viewport pixels.
 * @returns True when the click is in empty space below rendered markdown blocks.
 */
function isBelowEditorContent(editable: HTMLElement, clientY: number): boolean {
  const blocks = editable.querySelectorAll(':scope > *');
  if (blocks.length === 0) {
    return true;
  }

  const lastBlock = blocks[blocks.length - 1]!;
  return clientY > lastBlock.getBoundingClientRect().bottom;
}

/**
 * Markdown comment editor for request notes using MDXEditor.
 */
export function CommentEditor({
  value,
  onChange,
  variables,
  onEditVariables,
  label = 'Comment',
  description = 'Leave a comment to describe the request. Markdown is supported.',
  actions,
  enableFormatDocument = false
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const codeMirrorExtensions = useMarkdownCodeMirrorTheme(variables, onEditVariables);

  /**
   * MDXEditor plugins including variable highlighting for rich text and code blocks.
   */
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'json' }),
      codeMirrorPlugin({
        codeBlockLanguages: CODE_BLOCK_LANGUAGES,
        codeMirrorExtensions
      }),
      tablePlugin(),
      markdownShortcutPlugin(),
      variableHighlightPlugin({ variables, onEditVariable: onEditVariables })
    ],
    [codeMirrorExtensions, variables, onEditVariables]
  );

  /**
   * Pushes user edits into the draft without rebinding the `markdown` prop (avoids lag).
   */
  const handleChange = useCallback(
    (markdown: string, initialMarkdownNormalize: boolean): void => {
      if (initialMarkdownNormalize) {
        return;
      }

      lastEmittedRef.current = markdown;
      onChange(markdown);
    },
    [onChange]
  );

  /**
   * Syncs AI or tab-switch draft updates into the editor via ref when value changes externally.
   */
  useEffect(() => {
    if (value === lastEmittedRef.current) {
      return;
    }

    editorRef.current?.setMarkdown(value);
    lastEmittedRef.current = value;
  }, [value]);

  /**
   * Focuses the editor at the end when the user clicks empty space below markdown content
   * or on the scroll container gutter, since Lexical does not place the caret there by default.
   */
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const scrollRoot = shell.querySelector(COMMENT_EDITOR_SCROLL_ROOT);
    if (!(scrollRoot instanceof HTMLElement)) {
      return;
    }

    /**
     * Moves focus and selection to the document end for below-content or gutter clicks.
     *
     * @param event - Mousedown on the MDXEditor scroll container.
     */
    const handleMouseDown = (event: MouseEvent): void => {
      const editable = scrollRoot.querySelector(COMMENT_EDITOR_CONTENT);
      if (!(editable instanceof HTMLElement)) {
        return;
      }

      const clickedScrollGutter = event.target === scrollRoot;
      const clickedBelowContent =
        editable.contains(event.target as Node) && isBelowEditorContent(editable, event.clientY);

      if (!clickedScrollGutter && !clickedBelowContent) {
        return;
      }

      event.preventDefault();
      editorRef.current?.focus(undefined, { defaultSelection: 'rootEnd' });
    };

    scrollRoot.addEventListener('mousedown', handleMouseDown);
    return () => {
      scrollRoot.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  /**
   * Routes plain-text markdown document pastes through MDXEditor's markdown importer
   * so fenced code blocks and headings render as rich blocks instead of literal text.
   */
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const scrollRoot = shell.querySelector(COMMENT_EDITOR_SCROLL_ROOT);
    if (!(scrollRoot instanceof HTMLElement)) {
      return;
    }

    /**
     * Imports markdown-shaped clipboard text at the current selection.
     *
     * @param event - Paste event from the MDXEditor scroll container (capture phase).
     */
    const handlePaste = (event: ClipboardEvent): void => {
      const clipboard = event.clipboardData;
      if (!clipboard || clipboardHasRichHtml(clipboard)) {
        return;
      }

      const text = clipboard.getData('text/plain');
      if (!shouldParsePasteAsMarkdown(text)) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.cm-editor')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      editorRef.current?.insertMarkdown(text);
    };

    scrollRoot.addEventListener('paste', handlePaste, true);
    return () => {
      scrollRoot.removeEventListener('paste', handlePaste, true);
    };
  }, []);

  /**
   * Formats the active markdown document when the user chooses Format Document
   * from the native context menu.
   */
  useEffect(() => {
    if (!enableFormatDocument) {
      return;
    }

    const unsubscribe = window.api.onMenuAction((action) => {
      if (action !== 'format-markdown-document') {
        return;
      }

      void (async () => {
        try {
          const current = editorRef.current?.getMarkdown() ?? lastEmittedRef.current;
          const formatted = await formatMarkdown(current);
          if (formatted === current) {
            return;
          }

          editorRef.current?.setMarkdown(formatted);
          lastEmittedRef.current = formatted;
          onChange(formatted);
        } catch (error) {
          showAlert(dispatch, formatErrorMessage(error, 'Could not format the markdown document.'));
        }
      })();
    });

    return unsubscribe;
  }, [dispatch, enableFormatDocument, onChange]);

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col border border-separator p-4"
      role="group"
      aria-label={label}
    >
      <div className="mb-2 flex items-start justify-between gap-4">
        <FormGroup label={label} className="border-none! min-w-0 flex-1 p-0!">
          <p className="text-sm text-muted text-[16px]">{description}</p>
        </FormGroup>
        {actions ? <div className="shrink-0 pt-1">{actions}</div> : null}
      </div>
      <div
        ref={shellRef}
        className="flex min-h-0 flex-1 flex-col"
        {...(enableFormatDocument ? { 'data-markdown-document-editor': '' } : {})}
      >
        <MDXEditor
          ref={editorRef}
          markdown={value}
          onChange={handleChange}
          plugins={plugins}
          className="request-comment-editor app-no-drag min-h-0 flex-1 h-full bg-field rounded-lg! border border-separator focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
          contentEditableClassName="request-comment-editor-content bg-field outline-none"
        />
      </div>
    </div>
  );
}
