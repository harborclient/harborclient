import { describe, expect, it } from 'vitest';
import { shouldPreferDropTargetCollision } from './utils';

describe('shouldPreferDropTargetCollision', () => {
  it('returns false for folder drags over folder drop zones', () => {
    expect(shouldPreferDropTargetCollision('drop:folder:1', 'folder')).toBe(false);
  });

  it('returns false for folder drags over collection root drop zones', () => {
    expect(shouldPreferDropTargetCollision('drop:root:1', 'folder')).toBe(false);
  });

  it('returns true for request drags over folder drop zones', () => {
    expect(shouldPreferDropTargetCollision('drop:folder:1', 'request')).toBe(true);
  });

  it('returns true for document drags over folder drop zones', () => {
    expect(shouldPreferDropTargetCollision('drop:folder:1', 'document')).toBe(true);
  });

  it('returns true when drag kind is unknown and id is a drop target', () => {
    expect(shouldPreferDropTargetCollision('drop:folder:1', null)).toBe(true);
  });

  it('returns false for non-drop ids', () => {
    expect(shouldPreferDropTargetCollision('folder:1', 'request')).toBe(false);
    expect(shouldPreferDropTargetCollision('request:1', null)).toBe(false);
  });
});
