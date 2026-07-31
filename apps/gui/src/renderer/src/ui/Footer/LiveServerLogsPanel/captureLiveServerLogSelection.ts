import { buildLogsReferenceToken } from '@harborclient/core/ai/scriptReferences';

/** Lines of access-log context to include before and after a copied selection. */
export const LIVE_SERVER_LOG_SELECTION_CONTEXT_LINES = 10;

/** Delay before showing the copy-to-chat toolbar after a selection settles. */
export const LIVE_SERVER_LOG_SELECTION_TOOLBAR_DELAY_MS = 450;

/** Vertical offset below the selection when positioning the toolbar. */
const LIVE_SERVER_LOG_SELECTION_TOOLBAR_OFFSET_PX = 8;

/**
 * Captured access-log selection ready for `@logs` chat pointers.
 */
export interface LiveServerLogSelectionCapture {
  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * 1-based start line in the displayed log buffer.
   */
  startLine: number;

  /**
   * 1-based end line in the displayed log buffer.
   */
  endLine: number;

  /**
   * Surrounding log lines included for agent context.
   */
  contextText: string;
}

/**
 * Finds the nearest log-line element that carries a `data-line` attribute.
 *
 * @param node - DOM node from a selection boundary.
 * @param container - Scrollable log terminal root.
 * @returns Line element, or null when the node is outside the log buffer.
 */
function findLineElement(node: Node, container: HTMLElement): HTMLElement | null {
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  while (current instanceof HTMLElement && container.contains(current)) {
    if (current.dataset.line != null) {
      return current;
    }
    if (current === container) {
      break;
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Parses a 1-based line number from a log-line element's `data-line` attribute.
 *
 * @param element - Element that may carry `data-line`.
 * @returns Positive line number, or null when missing/invalid.
 */
function parseLineNumber(element: HTMLElement | null): number | null {
  if (element == null) {
    return null;
  }

  const raw = element.dataset.line;
  if (raw == null) {
    return null;
  }

  const line = Number.parseInt(raw, 10);
  if (!Number.isInteger(line) || line < 1) {
    return null;
  }

  return line;
}

/**
 * Collects ordered log-line elements inside the terminal container.
 *
 * @param container - Scrollable log terminal root.
 * @returns Line elements sorted by 1-based line number.
 */
function listLogLineElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-line]')).sort((left, right) => {
    const leftLine = parseLineNumber(left) ?? 0;
    const rightLine = parseLineNumber(right) ?? 0;
    return leftLine - rightLine;
  });
}

/**
 * Reads plain-text lines from the log buffer within an inclusive 1-based range.
 *
 * @param container - Scrollable log terminal root.
 * @param startLine - 1-based first line to read.
 * @param endLine - 1-based last line to read.
 * @returns Joined buffer lines as plain text.
 */
export function readLiveServerLogLines(
  container: HTMLElement,
  startLine: number,
  endLine: number
): string {
  const lines: string[] = [];

  for (const element of listLogLineElements(container)) {
    const line = parseLineNumber(element);
    if (line == null || line < startLine || line > endLine) {
      continue;
    }
    lines.push(element.textContent ?? '');
  }

  return lines.join('\n');
}

/**
 * Captures the user's access-log selection and surrounding context lines.
 *
 * Selection ranges map to 1-based `data-line` indexes in the displayed buffer,
 * matching `@logs.<uuid>#start.end` semantics.
 *
 * @param container - Scrollable log terminal root.
 * @param contextPadding - Number of lines to include before and after the selection.
 * @returns Selection metadata, or null when no usable selection is present.
 */
export function captureLiveServerLogSelection(
  container: HTMLElement,
  contextPadding = LIVE_SERVER_LOG_SELECTION_CONTEXT_LINES
): LiveServerLogSelectionCapture | null {
  const selection = window.getSelection();
  if (selection == null || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const selectedText = selection.toString();
  if (selectedText.trim().length === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const startLine = parseLineNumber(findLineElement(range.startContainer, container));
  const endLine = parseLineNumber(findLineElement(range.endContainer, container));
  if (startLine == null || endLine == null) {
    return null;
  }

  const normalizedStart = Math.min(startLine, endLine);
  const normalizedEnd = Math.max(startLine, endLine);
  const lineElements = listLogLineElements(container);
  const maxLine = lineElements.reduce((max, element) => {
    const line = parseLineNumber(element);
    return line != null ? Math.max(max, line) : max;
  }, 0);

  const contextStart = Math.max(1, normalizedStart - contextPadding);
  const contextEnd = Math.min(maxLine, normalizedEnd + contextPadding);
  // Prefer joined line text so multi-line selections keep newlines even when the
  // DOM Selection API concatenates block contents (common in jsdom / some engines).
  const selectedLinesText = readLiveServerLogLines(container, normalizedStart, normalizedEnd);

  return {
    selectedText: selectedLinesText.length > 0 ? selectedLinesText : selectedText,
    startLine: normalizedStart,
    endLine: normalizedEnd,
    contextText: readLiveServerLogLines(container, contextStart, contextEnd)
  };
}

/**
 * Returns viewport coordinates for a floating selection toolbar under the DOM selection.
 *
 * @param container - Log terminal element used as a fallback anchor.
 * @returns Fixed-position coordinates, or null when no selection is available.
 */
export function getLiveServerLogSelectionToolbarCoords(
  container: HTMLElement
): { top: number; left: number } | null {
  const selection = window.getSelection();
  if (selection == null || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const fallbackCoords = {
    top: containerRect.top + LIVE_SERVER_LOG_SELECTION_TOOLBAR_OFFSET_PX,
    left: containerRect.left + LIVE_SERVER_LOG_SELECTION_TOOLBAR_OFFSET_PX
  };

  if (typeof range.getBoundingClientRect !== 'function') {
    return fallbackCoords;
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return fallbackCoords;
  }

  return {
    top: rect.bottom + LIVE_SERVER_LOG_SELECTION_TOOLBAR_OFFSET_PX,
    left: rect.left
  };
}

/**
 * Builds the `@logs` reference token for a saved live server selection.
 *
 * @param uuid - Saved live server UUID.
 * @param startLine - 1-based start line of the selection.
 * @param endLine - 1-based end line of the selection.
 * @returns Compact `@logs` reference token for the chat composer.
 */
export function buildLiveServerLogsSelectionToken(
  uuid: string,
  startLine: number,
  endLine: number
): string {
  return buildLogsReferenceToken(uuid, startLine, endLine);
}
