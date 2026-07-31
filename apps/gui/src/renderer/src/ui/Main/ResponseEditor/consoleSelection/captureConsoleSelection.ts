import {
  buildConsoleReferenceToken,
  slugifyConsolePointerSegment,
  type ConsoleRowSnapshot
} from '@harborclient/core/ai/scriptReferences';
import { isCopyToChatShortcutEvent } from '#/renderer/src/ui/Main/RequestEditor/Editor/markdownSelection';

/** Delay before showing the copy-to-chat toolbar after a selection settles. */
export const CONSOLE_SELECTION_TOOLBAR_DELAY_MS = 450;

/** Vertical offset below the selection when positioning the toolbar. */
const CONSOLE_SELECTION_TOOLBAR_OFFSET_PX = 8;

/**
 * Captured console/header/timing cell selection ready for `@console` chat pointers.
 */
export interface ConsoleSelectionCapture {
  /**
   * Section id from `data-console-section`.
   */
  section: string;

  /**
   * Slugified row id from `data-console-row`.
   */
  row: string;

  /**
   * Human-readable row label from `data-console-row-label`.
   */
  rowLabel: string;

  /**
   * Full text of the annotated cell.
   */
  fieldText: string;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Inclusive character offset into {@link fieldText}.
   */
  startOffset: number;

  /**
   * Exclusive character offset into {@link fieldText}.
   */
  endOffset: number;
}

/**
 * Optional send metadata attached to a console-row snapshot at copy time.
 */
export interface ConsoleSelectionSnapshotMeta {
  /**
   * Request display name when available.
   */
  requestName?: string;

  /**
   * HTTP status code when available.
   */
  status?: number;

  /**
   * HTTP status text when available.
   */
  statusText?: string;

  /**
   * Transport error message when the send failed.
   */
  error?: string;
}

/**
 * Finds the nearest ancestor carrying console selection data attributes.
 *
 * @param node - DOM node from a selection boundary.
 * @param container - Selection host root.
 * @returns Annotated cell element, or null when outside a console cell.
 */
function findConsoleCellElement(node: Node, container: HTMLElement): HTMLElement | null {
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  while (current instanceof HTMLElement && container.contains(current)) {
    if (
      current.dataset.consoleSection != null &&
      current.dataset.consoleRow != null &&
      current.dataset.consoleRowLabel != null
    ) {
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
 * Computes character offsets of a range within an element's text content.
 *
 * @param element - Annotated console cell element.
 * @param range - Live document selection range.
 * @returns Offsets and selected text, or null when the range is empty/invalid.
 */
function getOffsetsInElement(
  element: HTMLElement,
  range: Range
): { startOffset: number; endOffset: number; selectedText: string } | null {
  const selectedText = range.toString();
  if (selectedText.trim().length === 0) {
    return null;
  }

  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;
  const endOffset = startOffset + selectedText.length;
  const fieldText = element.textContent ?? '';

  if (startOffset < 0 || endOffset > fieldText.length || endOffset <= startOffset) {
    return null;
  }

  return { startOffset, endOffset, selectedText };
}

/**
 * Captures the user's selection when it lies inside an annotated console cell.
 *
 * @param container - Selection host root element.
 * @returns Selection metadata, or null when no usable console selection is present.
 */
export function captureConsoleSelection(container: HTMLElement): ConsoleSelectionCapture | null {
  const selection = window.getSelection();
  if (selection == null || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const startCell = findConsoleCellElement(range.startContainer, container);
  const endCell = findConsoleCellElement(range.endContainer, container);
  if (startCell == null || endCell == null || startCell !== endCell) {
    return null;
  }

  const section = startCell.dataset.consoleSection;
  const row = startCell.dataset.consoleRow;
  const rowLabel = startCell.dataset.consoleRowLabel;
  if (section == null || row == null || rowLabel == null) {
    return null;
  }

  const offsets = getOffsetsInElement(startCell, range);
  if (offsets == null) {
    return null;
  }

  return {
    section,
    row,
    rowLabel,
    fieldText: startCell.textContent ?? '',
    selectedText: offsets.selectedText,
    startOffset: offsets.startOffset,
    endOffset: offsets.endOffset
  };
}

/**
 * Returns fixed-position coordinates for a floating selection toolbar.
 *
 * @param container - Selection host root used as a fallback anchor.
 * @returns Viewport coordinates, or null when no selection is available.
 */
export function getConsoleSelectionToolbarCoords(
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
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const containerRect = container.getBoundingClientRect();
    return {
      top: containerRect.top + CONSOLE_SELECTION_TOOLBAR_OFFSET_PX,
      left: containerRect.left + CONSOLE_SELECTION_TOOLBAR_OFFSET_PX
    };
  }

  return {
    top: rect.bottom + CONSOLE_SELECTION_TOOLBAR_OFFSET_PX,
    left: rect.left
  };
}

/**
 * Builds a console-row snapshot and `@console` token from a captured selection.
 *
 * @param capture - Selection metadata from {@link captureConsoleSelection}.
 * @param meta - Optional send metadata for the snapshot.
 * @returns Token and snapshot ready for Redux + Copy to chat.
 */
export function buildConsoleSelectionCopyPayload(
  capture: ConsoleSelectionCapture,
  meta: ConsoleSelectionSnapshotMeta = {}
): { token: string; snapshot: ConsoleRowSnapshot } {
  const token = buildConsoleReferenceToken(
    capture.section,
    capture.row,
    capture.startOffset,
    capture.endOffset
  );
  const sectionTitle =
    capture.section.charAt(0).toUpperCase() + capture.section.slice(1).replace(/-/g, ' ');

  return {
    token,
    snapshot: {
      label: `${sectionTitle} · ${capture.rowLabel}`,
      section: capture.section,
      row: capture.row,
      rowLabel: capture.rowLabel,
      fieldText: capture.fieldText,
      selectedText: capture.selectedText,
      startOffset: capture.startOffset,
      endOffset: capture.endOffset,
      ...(meta.requestName != null ? { requestName: meta.requestName } : {}),
      ...(meta.status != null ? { status: meta.status } : {}),
      ...(meta.statusText != null ? { statusText: meta.statusText } : {}),
      ...(meta.error != null ? { error: meta.error } : {})
    }
  };
}

/**
 * Builds data attributes for an annotated console/header/timing cell.
 *
 * @param section - Section id (for example `general` or `headers`).
 * @param rowLabel - Human-readable row label used for slugification and badges.
 * @returns Dataset props for the value (or label) element.
 */
export function consoleCellDataAttrs(
  section: string,
  rowLabel: string
): {
  'data-console-section': string;
  'data-console-row': string;
  'data-console-row-label': string;
} | null {
  const row = slugifyConsolePointerSegment(rowLabel);
  if (row.length === 0) {
    return null;
  }

  return {
    'data-console-section': section,
    'data-console-row': row,
    'data-console-row-label': rowLabel
  };
}

export { isCopyToChatShortcutEvent, slugifyConsolePointerSegment };
