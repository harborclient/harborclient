import { COPY_TO_CHAT_SHORTCUT_LETTER } from '#/renderer/src/hooks/useCopyToChat';

/** Delay before showing the copy-to-chat toolbar after a selection settles. */
export const MARKDOWN_SELECTION_TOOLBAR_DELAY_MS = 450;

/** Vertical offset below the selection when positioning the toolbar. */
const MARKDOWN_SELECTION_TOOLBAR_OFFSET_PX = 8;

/**
 * Returns whether a keyboard event matches the copy-to-chat shortcut chord.
 *
 * @param event - Keyboard event fields used for shortcut matching.
 * @returns True when the event is Ctrl+Shift+O on keydown.
 */
export function isCopyToChatShortcutEvent(event: {
  type: string;
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
}): boolean {
  return (
    event.type === 'keydown' &&
    event.ctrlKey &&
    event.shiftKey &&
    event.key.toLowerCase() === COPY_TO_CHAT_SHORTCUT_LETTER
  );
}

/**
 * Builds the `@markdown` reference token for a markdown selection.
 *
 * @param markdownUuid - UUID of the collection document or saved request.
 * @param startOffset - Start character offset in the markdown source.
 * @param endOffset - End character offset in the markdown source.
 * @returns Compact `@markdown` reference token for the chat composer.
 */
export function buildMarkdownReferenceToken(
  markdownUuid: string,
  startOffset: number,
  endOffset: number
): string {
  return `@markdown.${markdownUuid}#${startOffset}.${endOffset}`;
}

/**
 * Returns the 1-based line number for a character offset in markdown source.
 *
 * @param source - Markdown source text.
 * @param offset - Character offset into the source.
 */
export function lineNumberAtOffset(source: string, offset: number): number {
  const clamped = Math.min(Math.max(0, offset), source.length);
  let line = 1;

  for (let index = 0; index < clamped; index += 1) {
    if (source[index] === '\n') {
      line += 1;
    }
  }

  return line;
}

/**
 * Finds best-effort character offsets for a selected substring in markdown source.
 *
 * @param markdown - Full markdown source text.
 * @param selectedText - Plain-text selection from the editor.
 * @returns Start and end offsets suitable for `@markdown` reference suffixes.
 */
export function findMarkdownSelectionOffsets(
  markdown: string,
  selectedText: string
): { start: number; end: number } {
  if (selectedText.length === 0) {
    return { start: 0, end: 0 };
  }

  const exactIndex = markdown.indexOf(selectedText);
  if (exactIndex >= 0) {
    return { start: exactIndex, end: exactIndex + selectedText.length };
  }

  const trimmed = selectedText.trim();
  if (trimmed.length > 0) {
    const trimmedIndex = markdown.indexOf(trimmed);
    if (trimmedIndex >= 0) {
      return { start: trimmedIndex, end: trimmedIndex + trimmed.length };
    }
  }

  return { start: 0, end: Math.min(markdown.length, selectedText.length) };
}

/**
 * Captures the user's markdown editor selection when it lies inside the shell.
 *
 * @param shell - Comment editor shell element that hosts MDXEditor.
 * @returns Selection metadata, or null when no usable selection is present.
 */
export function captureMarkdownSelection(shell: HTMLElement): { selectedText: string } | null {
  const selection = window.getSelection();
  if (selection == null || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const selectedText = selection.toString();
  if (selectedText.trim().length === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!shell.contains(range.commonAncestorContainer)) {
    return null;
  }

  return { selectedText };
}

/**
 * Returns fixed-position coordinates anchored to a container element.
 *
 * @param container - Markdown editor shell element.
 * @returns Viewport coordinates near the container's top-left corner.
 */
function getContainerToolbarCoords(container: HTMLElement): { top: number; left: number } {
  const containerRect = container.getBoundingClientRect();
  return {
    top: containerRect.top + MARKDOWN_SELECTION_TOOLBAR_OFFSET_PX,
    left: containerRect.left + MARKDOWN_SELECTION_TOOLBAR_OFFSET_PX
  };
}

/**
 * Returns viewport coordinates for a floating selection toolbar.
 *
 * @param shell - Markdown editor shell element used as a fallback anchor.
 * @returns Fixed-position coordinates, or null when no selection is available.
 */
export function getMarkdownSelectionToolbarCoords(
  shell: HTMLElement
): { top: number; left: number } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const selection = window.getSelection();
  if (selection == null || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!shell.contains(range.commonAncestorContainer)) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return getContainerToolbarCoords(shell);
  }

  return {
    top: rect.bottom + MARKDOWN_SELECTION_TOOLBAR_OFFSET_PX,
    left: rect.left
  };
}
