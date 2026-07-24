import { describe, expect, it } from 'vitest';
import {
  buildMarkdownReferenceToken,
  findMarkdownSelectionOffsets,
  isCopyToChatShortcutEvent,
  lineNumberAtOffset
} from './markdownSelection';

describe('markdownSelection helpers', () => {
  it('builds a compact @markdown reference token', () => {
    expect(buildMarkdownReferenceToken('44444444-4444-4444-4444-444444444444', 10, 42)).toBe(
      '@markdown.44444444-4444-4444-4444-444444444444#10.42'
    );
  });

  it('detects the copy-to-chat shortcut chord', () => {
    expect(
      isCopyToChatShortcutEvent({
        type: 'keydown',
        key: 'O',
        ctrlKey: true,
        shiftKey: true
      })
    ).toBe(true);
    expect(
      isCopyToChatShortcutEvent({
        type: 'keydown',
        key: 'o',
        ctrlKey: true,
        shiftKey: false
      })
    ).toBe(false);
  });

  it('finds exact markdown selection offsets', () => {
    expect(findMarkdownSelectionOffsets('# Title\n\nBody text', 'Body text')).toEqual({
      start: 9,
      end: 18
    });
  });

  it('falls back to trimmed selection offsets', () => {
    expect(findMarkdownSelectionOffsets('# Title\n\nBody text', '  Body text  ')).toEqual({
      start: 9,
      end: 18
    });
  });

  it('computes 1-based line numbers from offsets', () => {
    expect(lineNumberAtOffset('# Title\n\nBody text', 9)).toBe(3);
    expect(lineNumberAtOffset('# Title\n\nBody text', 0)).toBe(1);
  });
});
