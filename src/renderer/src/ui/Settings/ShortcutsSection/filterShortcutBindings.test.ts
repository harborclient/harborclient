import { describe, expect, it } from 'vitest';
import type { ShortcutBinding } from '#/shared/types';
import { filterShortcutBindings } from './filterShortcutBindings';

const SAMPLE_BINDINGS: ShortcutBinding[] = [
  {
    id: 'save',
    label: 'Save',
    accelerator: 'CmdOrCtrl+S',
    defaultAccelerator: 'CmdOrCtrl+S'
  },
  {
    id: 'send-request',
    label: 'Send request',
    accelerator: 'F5',
    defaultAccelerator: 'F5'
  },
  {
    id: 'shortcuts-reference',
    label: 'Keyboard shortcuts',
    accelerator: 'Alt+Shift+K',
    defaultAccelerator: 'Alt+Shift+K'
  }
];

describe('filterShortcutBindings', () => {
  it('returns all bindings when query is empty or whitespace', () => {
    expect(filterShortcutBindings(SAMPLE_BINDINGS, '')).toEqual(SAMPLE_BINDINGS);
    expect(filterShortcutBindings(SAMPLE_BINDINGS, '   ')).toEqual(SAMPLE_BINDINGS);
  });

  it('filters by shortcut label', () => {
    expect(filterShortcutBindings(SAMPLE_BINDINGS, 'send')).toEqual([SAMPLE_BINDINGS[1]]);
  });

  it('filters by formatted accelerator display', () => {
    expect(filterShortcutBindings(SAMPLE_BINDINGS, 'alt-shift-k')).toEqual([SAMPLE_BINDINGS[2]]);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterShortcutBindings(SAMPLE_BINDINGS, 'zzzz')).toEqual([]);
  });
});
