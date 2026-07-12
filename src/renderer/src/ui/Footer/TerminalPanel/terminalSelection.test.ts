import { describe, expect, it } from 'vitest';
import {
  buildTerminalReferenceToken,
  getTerminalSelectionToolbarCoords,
  isCopyToChatShortcutEvent,
  readTerminalBufferLines
} from '#/renderer/src/ui/Footer/TerminalPanel/terminalSelection';

/**
 * Builds a minimal element stub with a fixed bounding rect.
 *
 * @param rect - Bounding rectangle returned by `getBoundingClientRect`.
 */
function elementStub(rect: { top: number; left: number; width: number; height: number }): {
  getBoundingClientRect: () => DOMRect;
} {
  return {
    getBoundingClientRect: () =>
      ({
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({})
      }) as DOMRect
  };
}

/**
 * Builds a minimal xterm-like terminal stub for geometry tests.
 *
 * @param overrides - Partial terminal fields to override defaults.
 */
function terminalStub(
  overrides: {
    elementRect?: { top: number; left: number; width: number; height: number };
    position?: { start: { x: number; y: number }; end: { x: number; y: number } };
    viewportY?: number;
    cols?: number;
    rows?: number;
    hasSelection?: boolean;
    selectionText?: string;
  } = {}
): {
  element: { getBoundingClientRect: () => DOMRect };
  cols: number;
  rows: number;
  hasSelection: () => boolean;
  getSelection: () => string;
  getSelectionPosition: () =>
    | { start: { x: number; y: number }; end: { x: number; y: number } }
    | undefined;
  buffer: { active: { viewportY: number } };
} {
  const rect = overrides.elementRect ?? {
    top: 100,
    left: 200,
    width: 800,
    height: 400
  };

  return {
    element: elementStub(rect),
    cols: overrides.cols ?? 80,
    rows: overrides.rows ?? 24,
    hasSelection: () => overrides.hasSelection ?? true,
    getSelection: () => overrides.selectionText ?? 'selected text',
    getSelectionPosition: () => overrides.position,
    buffer: {
      active: {
        viewportY: overrides.viewportY ?? 0
      }
    }
  };
}

describe('terminalSelection helpers', () => {
  it('builds a compact @term reference token', () => {
    expect(buildTerminalReferenceToken(2, 1, 33)).toBe('@term.2#1.33');
  });

  it('reads plain-text lines from an xterm buffer', () => {
    const buffer = {
      length: 3,
      getLine: (index: number) => ({
        translateToString: (trimRight?: boolean) => {
          void trimRight;
          return ['line1', 'line2', 'line3'][index] ?? '';
        }
      })
    };

    const terminal = {
      buffer: {
        active: buffer
      }
    };

    expect(readTerminalBufferLines(terminal as never, 1, 3)).toBe('line1\nline2\nline3');
    expect(readTerminalBufferLines(terminal as never, 2, 2)).toBe('line2');
  });

  it('derives toolbar coordinates from xterm selection geometry', () => {
    const container = elementStub({
      top: 80,
      left: 160,
      width: 840,
      height: 440
    });

    const terminal = terminalStub({
      position: {
        start: { x: 3, y: 5 },
        end: { x: 10, y: 7 }
      },
      viewportY: 4
    });

    expect(getTerminalSelectionToolbarCoords(terminal as never, container as never)).toEqual({
      left: 200 + 9 * 10,
      top: 100 + 3 * (400 / 24) + 8
    });
  });

  it('falls back to the container corner when xterm selection position is missing', () => {
    const container = elementStub({
      top: 80,
      left: 160,
      width: 840,
      height: 440
    });

    const terminal = terminalStub({
      position: undefined,
      selectionText: 'selected text'
    });

    expect(getTerminalSelectionToolbarCoords(terminal as never, container as never)).toEqual({
      top: 88,
      left: 168
    });
  });

  it('returns null when there is no terminal selection', () => {
    const container = elementStub({
      top: 80,
      left: 160,
      width: 840,
      height: 440
    });
    const terminal = terminalStub({
      hasSelection: false,
      selectionText: '',
      position: undefined
    });

    expect(getTerminalSelectionToolbarCoords(terminal as never, container as never)).toBeNull();
  });
});

describe('isCopyToChatShortcutEvent', () => {
  it('matches Ctrl+Shift+O on keydown', () => {
    expect(
      isCopyToChatShortcutEvent({
        type: 'keydown',
        key: 'O',
        ctrlKey: true,
        shiftKey: true
      })
    ).toBe(true);
  });

  it('rejects non-keydown events', () => {
    expect(
      isCopyToChatShortcutEvent({
        type: 'keyup',
        key: 'O',
        ctrlKey: true,
        shiftKey: true
      })
    ).toBe(false);
  });

  it('rejects the wrong key', () => {
    expect(
      isCopyToChatShortcutEvent({
        type: 'keydown',
        key: 'L',
        ctrlKey: true,
        shiftKey: true
      })
    ).toBe(false);
  });

  it('rejects missing modifiers', () => {
    expect(
      isCopyToChatShortcutEvent({
        type: 'keydown',
        key: 'O',
        ctrlKey: true,
        shiftKey: false
      })
    ).toBe(false);
    expect(
      isCopyToChatShortcutEvent({
        type: 'keydown',
        key: 'O',
        ctrlKey: false,
        shiftKey: true
      })
    ).toBe(false);
  });
});
