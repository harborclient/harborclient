import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  displayShortcut,
  keyboardEventToShortcut,
  normalizeShortcut,
  type ShortcutKeyboardEvent
} from './shortcut.ts';

/**
 * Builds a keyboard event stand-in for shortcut conversion tests.
 *
 * @param overrides - Fields to merge onto an unshifted letter press.
 * @returns Complete shortcut keyboard event.
 */
function makeEvent(overrides: Partial<ShortcutKeyboardEvent> = {}): ShortcutKeyboardEvent {
  return {
    altKey: false,
    ctrlKey: false,
    key: 'a',
    metaKey: false,
    shiftKey: false,
    ...overrides
  };
}

describe('normalizeShortcut', () => {
  it('orders modifiers and lowercases the key', () => {
    assert.equal(normalizeShortcut('Shift+Ctrl+.'), 'ctrl+shift+.');
  });
});

describe('keyboardEventToShortcut', () => {
  it('returns null for modifier-only presses', () => {
    assert.equal(keyboardEventToShortcut(makeEvent({ key: 'Shift', shiftKey: true })), null);
  });

  it('maps letter shortcuts with modifiers', () => {
    assert.equal(
      keyboardEventToShortcut(makeEvent({ key: 'Enter', ctrlKey: true, code: 'Enter' })),
      'ctrl+enter'
    );
  });

  it('keeps period when Shift reports > but code is Period', () => {
    assert.equal(
      keyboardEventToShortcut(
        makeEvent({
          key: '>',
          code: 'Period',
          ctrlKey: true,
          shiftKey: true
        })
      ),
      'ctrl+shift+.'
    );
  });

  it('unwinds shifted punctuation when code is missing', () => {
    assert.equal(
      keyboardEventToShortcut(
        makeEvent({
          key: '>',
          ctrlKey: true,
          shiftKey: true
        })
      ),
      'ctrl+shift+.'
    );
  });

  it('unwinds shifted digit-row symbols when code is missing', () => {
    assert.equal(
      keyboardEventToShortcut(
        makeEvent({
          key: '!',
          altKey: true,
          shiftKey: true
        })
      ),
      'alt+shift+1'
    );
  });

  it('prefers Digit code over shifted symbol key', () => {
    assert.equal(
      keyboardEventToShortcut(
        makeEvent({
          key: '!',
          code: 'Digit1',
          altKey: true,
          shiftKey: true
        })
      ),
      'alt+shift+1'
    );
  });

  it('maps unshifted punctuation from code', () => {
    assert.equal(
      keyboardEventToShortcut(
        makeEvent({
          key: '.',
          code: 'Period',
          ctrlKey: true
        })
      ),
      'ctrl+.'
    );
  });
});

describe('displayShortcut', () => {
  it('uppercases single-character keys', () => {
    assert.deepEqual(displayShortcut('ctrl+shift+.'), ['Ctrl', 'Shift', '.']);
  });
});
