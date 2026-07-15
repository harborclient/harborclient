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
import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';
import { FormGroup, SelectionActionToolbar } from '@harborclient/sdk/components';
import { faCopy } from '#/renderer/src/fontawesome';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { COPY_TO_CHAT_SHORTCUT_HINT } from '#/renderer/src/hooks/useCopyToChat';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setMarkdownSelection } from '#/renderer/src/store/slices/markdownSelectionsSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { clipboardHasRichHtml, shouldParsePasteAsMarkdown } from './pasteMarkdownUtils';
import { formatMarkdown } from './formatMarkdown';
import { useMarkdownCodeMirrorTheme } from './useMarkdownCodeMirrorTheme';
import { variableHighlightPlugin } from './variableHighlightPlugin';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import {
  buildMarkdownReferenceToken,
  captureMarkdownSelection,
  findMarkdownSelectionOffsets,
  getMarkdownSelectionToolbarCoords,
  isCopyToChatShortcutEvent,
  lineNumberAtOffset,
  MARKDOWN_SELECTION_TOOLBAR_DELAY_MS
} from './markdownSelection';

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

  /**
   * Stable uuid and label for copy-to-chat `@markdown` references.
   */
  markdownReference?: {
    /**
     * UUID of the collection document or saved request.
     */
    uuid: string;

    /**
     * Display label used in chat badges and selection snapshots.
     */
    label: string;
  };
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
  enableFormatDocument = false,
  markdownReference
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const activeChatId = useAppSelector(selectActiveChatId);
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const selectionToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCopySelectionToChatRef = useRef<() => Promise<void>>(async () => {});
  const [selectionToolbarVisible, setSelectionToolbarVisible] = useState(false);
  const [selectionToolbarCoords, setSelectionToolbarCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);
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
   * Hides the floating copy-to-chat toolbar.
   */
  const hideSelectionToolbar = useCallback((): void => {
    setSelectionToolbarVisible(false);
    setSelectionToolbarCoords(null);
  }, []);

  /**
   * Copies the current markdown selection into the AI chat composer.
   */
  const handleCopySelectionToChat = useCallback(async (): Promise<void> => {
    const shell = shellRef.current;
    if (!shell || markdownReference == null) {
      return;
    }

    const capture = captureMarkdownSelection(shell);
    if (capture == null) {
      return;
    }

    const markdown = editorRef.current?.getMarkdown() ?? lastEmittedRef.current;
    const offsets = findMarkdownSelectionOffsets(markdown, capture.selectedText);
    const token = buildMarkdownReferenceToken(markdownReference.uuid, offsets.start, offsets.end);

    dispatch(
      setMarkdownSelection({
        token,
        snapshot: {
          label: markdownReference.label,
          selectedText: capture.selectedText,
          startOffset: offsets.start,
          endOffset: offsets.end,
          startLine: lineNumberAtOffset(markdown, offsets.start),
          endLine: lineNumberAtOffset(markdown, Math.max(offsets.start, offsets.end - 1))
        }
      })
    );
    dispatch(setShowAiSidebar(true));
    if (activeChatId == null) {
      await dispatch(createNewChat(aiSettings));
    }

    dispatch(setPendingComposerText(token));
    window.getSelection()?.removeAllRanges();
    hideSelectionToolbar();
  }, [activeChatId, aiSettings, dispatch, hideSelectionToolbar, markdownReference]);

  /**
   * Keeps the copy-to-chat handler ref aligned so keyboard listeners can call
   * the latest callback without re-registering on every render.
   */
  useEffect(() => {
    handleCopySelectionToChatRef.current = handleCopySelectionToChat;
  }, [handleCopySelectionToChat]);

  /**
   * Shows or hides the copy-to-chat toolbar when the user selects markdown text.
   */
  useEffect(() => {
    if (!aiAvailable || markdownReference == null) {
      return;
    }

    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    /**
     * Debounces toolbar positioning until the selection settles.
     */
    const scheduleToolbarUpdate = (): void => {
      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
      }

      const capture = captureMarkdownSelection(shell);
      if (capture == null) {
        hideSelectionToolbar();
        return;
      }

      selectionToolbarTimerRef.current = setTimeout(() => {
        selectionToolbarTimerRef.current = null;
        const coords = getMarkdownSelectionToolbarCoords(shell);
        if (coords == null) {
          hideSelectionToolbar();
          return;
        }

        setSelectionToolbarCoords(coords);
        setSelectionToolbarVisible(true);
      }, MARKDOWN_SELECTION_TOOLBAR_DELAY_MS);
    };

    document.addEventListener('selectionchange', scheduleToolbarUpdate);
    shell.addEventListener('mouseup', scheduleToolbarUpdate);
    shell.addEventListener('keyup', scheduleToolbarUpdate);

    return () => {
      if (selectionToolbarTimerRef.current != null) {
        clearTimeout(selectionToolbarTimerRef.current);
      }

      document.removeEventListener('selectionchange', scheduleToolbarUpdate);
      shell.removeEventListener('mouseup', scheduleToolbarUpdate);
      shell.removeEventListener('keyup', scheduleToolbarUpdate);
      hideSelectionToolbar();
    };
  }, [aiAvailable, hideSelectionToolbar, markdownReference]);

  /**
   * Wires Ctrl+Shift+O to copy the current markdown selection to chat.
   */
  useEffect(() => {
    if (!aiAvailable || markdownReference == null) {
      return;
    }

    /**
     * Copies the current selection when the copy-to-chat shortcut is pressed.
     *
     * @param event - Keydown event from the document.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isCopyToChatShortcutEvent(event)) {
        return;
      }

      const shell = shellRef.current;
      if (!shell || captureMarkdownSelection(shell) == null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleCopySelectionToChatRef.current();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [aiAvailable, markdownReference]);

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

  const showSelectionToolbar =
    selectionToolbarVisible &&
    selectionToolbarCoords != null &&
    aiAvailable &&
    markdownReference != null;

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col border border-separator p-4"
      role="group"
      aria-label={label}
    >
      <div className="mb-2 flex items-start justify-between gap-4">
        <FormGroup label={label} className="border-none! min-w-0 flex-1 p-0!">
          <p className="text-sm text-muted">{description}</p>
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
      {showSelectionToolbar ? (
        <SelectionActionToolbar
          coords={selectionToolbarCoords}
          label={`Copy selection from ${markdownReference.label} to chat`}
          text="Copy to chat"
          icon={faCopy}
          shortcutHint={COPY_TO_CHAT_SHORTCUT_HINT}
          onSelect={() => {
            void handleCopySelectionToChat();
          }}
        />
      ) : null}
    </div>
  );
}
