import { describe, expect, it } from 'vitest';
import { acceleratorFromKeyboardEvent } from './acceleratorFromKeyboardEvent';

describe('acceleratorFromKeyboardEvent', () => {
  it('returns null for Escape and modifier-only keys', () => {
    expect(
      acceleratorFromKeyboardEvent({
        key: 'Escape',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBeNull();
    expect(
      acceleratorFromKeyboardEvent({
        key: 'Control',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBeNull();
  });

  it('maps letter shortcuts with CmdOrCtrl', () => {
    expect(
      acceleratorFromKeyboardEvent({
        key: 's',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBe('CmdOrCtrl+S');
  });

  it('maps shifted shortcuts and punctuation keys', () => {
    expect(
      acceleratorFromKeyboardEvent({
        key: 'N',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true
      })
    ).toBe('CmdOrCtrl+Shift+N');

    expect(
      acceleratorFromKeyboardEvent({
        key: ',',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBe('CmdOrCtrl+Comma');
  });

  it('maps function keys without modifiers', () => {
    expect(
      acceleratorFromKeyboardEvent({
        key: 'F11',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBe('F11');
  });

  it('maps Alt+Shift+digit when Shift produces a symbol key', () => {
    expect(
      acceleratorFromKeyboardEvent({
        key: '!',
        ctrlKey: false,
        metaKey: false,
        altKey: true,
        shiftKey: true
      })
    ).toBe('Alt+Shift+1');
  });
});
