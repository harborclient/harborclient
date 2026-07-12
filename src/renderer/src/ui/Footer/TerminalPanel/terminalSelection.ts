import type { Terminal } from '@xterm/xterm';
import { COPY_TO_CHAT_SHORTCUT_LETTER } from '#/renderer/src/hooks/useCopyToChat';

/** Lines of terminal context to include before and after a copied selection. */
export const TERMINAL_SELECTION_CONTEXT_LINES = 10;

/** Delay before showing the copy-to-chat toolbar after a selection settles. */
export const TERMINAL_SELECTION_TOOLBAR_DELAY_MS = 450;

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
 * Reads plain-text lines from the xterm buffer within an inclusive 1-based range.
 *
 * @param terminal - Active xterm instance.
 * @param startLine - 1-based first line to read.
 * @param endLine - 1-based last line to read.
 * @returns Joined buffer lines as plain text.
 */
export function readTerminalBufferLines(
  terminal: Terminal,
  startLine: number,
  endLine: number
): string {
  const buffer = terminal.buffer.active;
  const lines: string[] = [];
  const clampedStart = Math.max(1, startLine);
  const clampedEnd = Math.min(endLine, buffer.length);

  for (let lineNumber = clampedStart; lineNumber <= clampedEnd; lineNumber += 1) {
    const line = buffer.getLine(lineNumber - 1);
    lines.push(line?.translateToString(true) ?? '');
  }

  return lines.join('\n');
}

/**
 * Captures the user's terminal selection and surrounding context lines.
 *
 * @param terminal - Active xterm instance.
 * @param contextPadding - Number of lines to include before and after the selection.
 * @returns Selection metadata, or null when no usable selection is present.
 */
export function captureTerminalSelection(
  terminal: Terminal,
  contextPadding = TERMINAL_SELECTION_CONTEXT_LINES
): {
  selectedText: string;
  startLine: number;
  endLine: number;
  contextText: string;
} | null {
  if (!terminal.hasSelection()) {
    return null;
  }

  const selectedText = terminal.getSelection();
  if (selectedText.trim().length === 0) {
    return null;
  }

  const position = terminal.getSelectionPosition();
  if (position == null) {
    return null;
  }

  const startLine = Math.min(position.start.y, position.end.y);
  const endLine = Math.max(position.start.y, position.end.y);
  const contextStart = Math.max(1, startLine - contextPadding);
  const contextEnd = Math.min(terminal.buffer.active.length, endLine + contextPadding);

  return {
    selectedText,
    startLine,
    endLine,
    contextText: readTerminalBufferLines(terminal, contextStart, contextEnd)
  };
}

/**
 * Builds the `@term` reference token for a terminal selection.
 *
 * @param terminalIndex - 1-based index of the terminal tab.
 * @param startLine - 1-based start line of the selection.
 * @param endLine - 1-based end line of the selection.
 * @returns Compact `@term` reference token for the chat composer.
 */
export function buildTerminalReferenceToken(
  terminalIndex: number,
  startLine: number,
  endLine: number
): string {
  return `@term.${terminalIndex}#${startLine}.${endLine}`;
}

/** Vertical offset below the selection when positioning the toolbar. */
const TERMINAL_SELECTION_TOOLBAR_OFFSET_PX = 8;

/**
 * Returns fixed-position coordinates anchored to a container element.
 *
 * @param container - Terminal container element.
 * @returns Viewport coordinates near the container's top-left corner.
 */
function getContainerToolbarCoords(container: HTMLElement): { top: number; left: number } {
  const containerRect = container.getBoundingClientRect();
  return {
    top: containerRect.top + TERMINAL_SELECTION_TOOLBAR_OFFSET_PX,
    left: containerRect.left + TERMINAL_SELECTION_TOOLBAR_OFFSET_PX
  };
}

/**
 * Returns fixed-position coordinates from native DOM text selection, when present.
 *
 * @param container - Terminal container element used as a fallback anchor.
 * @returns Viewport coordinates, or null when DOM selection is unavailable.
 */
function getDomSelectionToolbarCoords(
  container: HTMLElement
): { top: number; left: number } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const selection = window.getSelection();
  if (selection == null || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return getContainerToolbarCoords(container);
  }

  return {
    top: rect.bottom + TERMINAL_SELECTION_TOOLBAR_OFFSET_PX,
    left: rect.left
  };
}

/**
 * Returns fixed-position coordinates derived from xterm selection geometry.
 *
 * @param terminal - Active xterm instance.
 * @param container - Terminal container element used as a fallback anchor.
 * @returns Viewport coordinates below the selection end, or null when unavailable.
 */
function getXtermSelectionToolbarCoords(
  terminal: Terminal,
  container: HTMLElement
): { top: number; left: number } | null {
  const position = terminal.getSelectionPosition();
  const element = terminal.element;
  if (position == null || element == null) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || terminal.cols <= 0 || terminal.rows <= 0) {
    return null;
  }

  const cellWidth = rect.width / terminal.cols;
  const cellHeight = rect.height / terminal.rows;
  const viewportY = terminal.buffer.active.viewportY;
  const endX = Math.max(position.start.x, position.end.x);
  const endY = Math.max(position.start.y, position.end.y);
  const viewportRow = endY - viewportY - 1;

  if (viewportRow < 0 || viewportRow >= terminal.rows) {
    return getContainerToolbarCoords(container);
  }

  return {
    left: rect.left + (endX - 1) * cellWidth,
    top: rect.top + (viewportRow + 1) * cellHeight + TERMINAL_SELECTION_TOOLBAR_OFFSET_PX
  };
}

/**
 * Returns viewport coordinates for a floating selection toolbar.
 *
 * xterm manages its own selection rendering and usually does not populate
 * `window.getSelection()`, so coordinates are derived from xterm geometry first.
 *
 * @param terminal - Active xterm instance.
 * @param container - Terminal container element used as a fallback anchor.
 * @returns Fixed-position coordinates, or null when no selection is available.
 */
export function getTerminalSelectionToolbarCoords(
  terminal: Terminal,
  container: HTMLElement
): { top: number; left: number } | null {
  const domCoords = getDomSelectionToolbarCoords(container);
  if (domCoords != null) {
    return domCoords;
  }

  const xtermCoords = getXtermSelectionToolbarCoords(terminal, container);
  if (xtermCoords != null) {
    return xtermCoords;
  }

  if (terminal.hasSelection() && terminal.getSelection().trim().length > 0) {
    return getContainerToolbarCoords(container);
  }

  return null;
}
