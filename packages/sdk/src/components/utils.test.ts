import { describe, expect, it } from 'vitest';
import { resolveMenuTypeahead, resolveTabListKeyAction } from './utils.js';

describe('resolveTabListKeyAction', () => {
  it('returns null for unhandled keys', () => {
    expect(resolveTabListKeyAction('Enter', 0, 3)).toBeNull();
    expect(resolveTabListKeyAction('Tab', 1, 3)).toBeNull();
  });

  it('returns null when itemCount is zero', () => {
    expect(resolveTabListKeyAction('ArrowRight', 0, 0)).toBeNull();
  });

  it('moves forward and backward with arrow keys', () => {
    expect(resolveTabListKeyAction('ArrowRight', 0, 3)).toBe(1);
    expect(resolveTabListKeyAction('ArrowDown', 1, 3)).toBe(2);
    expect(resolveTabListKeyAction('ArrowLeft', 0, 3)).toBe(2);
    expect(resolveTabListKeyAction('ArrowUp', 2, 3)).toBe(1);
  });

  it('jumps to first and last enabled items with Home and End', () => {
    expect(resolveTabListKeyAction('Home', 2, 3)).toBe(0);
    expect(resolveTabListKeyAction('End', 0, 3)).toBe(2);
  });

  it('skips disabled indices when navigating', () => {
    expect(resolveTabListKeyAction('ArrowRight', 0, 3, { disabledIndices: [1] })).toBe(2);
    expect(resolveTabListKeyAction('ArrowLeft', 2, 3, { disabledIndices: [1] })).toBe(0);
    expect(resolveTabListKeyAction('Home', 2, 3, { disabledIndices: [0] })).toBe(1);
    expect(resolveTabListKeyAction('End', 0, 3, { disabledIndices: [2] })).toBe(1);
  });
});

describe('resolveMenuTypeahead', () => {
  const labels = ['Rename', 'Duplicate', 'Delete'];

  it('returns null for non-printable keys', () => {
    expect(resolveMenuTypeahead(labels, 0, 'Enter', '')).toBeNull();
    expect(resolveMenuTypeahead(labels, 0, ' ', 'd')).toBeNull();
  });

  it('matches the next item whose label starts with the typed prefix', () => {
    expect(resolveMenuTypeahead(labels, 0, 'd', '')).toEqual({ index: 1, buffer: 'd' });
    expect(resolveMenuTypeahead(labels, 1, 'e', 'd')).toEqual({ index: 2, buffer: 'de' });
  });

  it('wraps the search from the current index', () => {
    expect(resolveMenuTypeahead(labels, 2, 'r', '')).toEqual({ index: 0, buffer: 'r' });
  });

  it('returns null when no label matches the prefix', () => {
    expect(resolveMenuTypeahead(labels, 0, 'z', '')).toBeNull();
  });
});
