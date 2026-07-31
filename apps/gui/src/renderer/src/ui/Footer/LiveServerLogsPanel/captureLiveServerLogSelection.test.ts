// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  buildLiveServerLogsSelectionToken,
  captureLiveServerLogSelection,
  getLiveServerLogSelectionToolbarCoords,
  readLiveServerLogLines
} from './captureLiveServerLogSelection';

/**
 * Builds a log terminal container with numbered line children for selection tests.
 *
 * @param lines - Plain-text lines to render.
 * @returns Container element appended to `document.body`.
 */
function mountLogContainer(lines: string[]): HTMLDivElement {
  const container = document.createElement('div');
  for (const [index, text] of lines.entries()) {
    const line = document.createElement('div');
    line.dataset.line = String(index + 1);
    line.textContent = text;
    container.appendChild(line);
  }
  document.body.appendChild(container);
  return container;
}

/**
 * Selects text spanning from the start of one line through the end of another.
 *
 * @param container - Mounted log container.
 * @param startLine - 1-based start line.
 * @param endLine - 1-based end line.
 */
function selectLineRange(container: HTMLElement, startLine: number, endLine: number): void {
  const start = container.querySelector(`[data-line="${startLine}"]`);
  const end = container.querySelector(`[data-line="${endLine}"]`);
  if (start?.firstChild == null || end?.firstChild == null) {
    throw new Error('Missing line text nodes for selection');
  }

  const range = document.createRange();
  range.setStart(start.firstChild, 0);
  range.setEnd(end.firstChild, end.firstChild.textContent?.length ?? 0);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('captureLiveServerLogSelection helpers', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
  });

  it('builds a compact @logs reference token with a line range', () => {
    const uuid = '55555555-5555-5555-5555-555555555555';
    expect(buildLiveServerLogsSelectionToken(uuid, 1, 40)).toBe(`@logs.${uuid}#1.40`);
  });

  it('reads plain-text lines from the log buffer', () => {
    const container = mountLogContainer(['line1', 'line2', 'line3']);
    expect(readLiveServerLogLines(container, 1, 3)).toBe('line1\nline2\nline3');
    expect(readLiveServerLogLines(container, 2, 2)).toBe('line2');
  });

  it('captures selected lines and surrounding context', () => {
    const container = mountLogContainer(['a', 'b', 'c', 'd', 'e']);
    selectLineRange(container, 2, 4);

    const capture = captureLiveServerLogSelection(container, 1);
    expect(capture).toEqual({
      selectedText: 'b\nc\nd',
      startLine: 2,
      endLine: 4,
      contextText: 'a\nb\nc\nd\ne'
    });
  });

  it('returns null when there is no selection', () => {
    const container = mountLogContainer(['only']);
    expect(captureLiveServerLogSelection(container)).toBeNull();
  });

  it('returns toolbar coordinates under a DOM selection', () => {
    const container = mountLogContainer(['hello']);
    selectLineRange(container, 1, 1);

    const coords = getLiveServerLogSelectionToolbarCoords(container);
    expect(coords).toEqual(
      expect.objectContaining({
        top: expect.any(Number),
        left: expect.any(Number)
      })
    );
  });
});
