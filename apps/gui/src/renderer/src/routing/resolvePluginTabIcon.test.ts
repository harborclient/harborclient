import { describe, expect, it } from 'vitest';
import { faPuzzlePiece, faServer } from '#/renderer/src/fontawesome';
import { resolvePluginTabIcon } from './resolvePluginTabIcon';

describe('resolvePluginTabIcon', () => {
  it('returns the mapped icon for a known name', () => {
    expect(resolvePluginTabIcon('server')).toBe(faServer);
  });

  it('falls back to puzzle-piece for unknown or empty names', () => {
    expect(resolvePluginTabIcon(undefined)).toBe(faPuzzlePiece);
    expect(resolvePluginTabIcon('')).toBe(faPuzzlePiece);
    expect(resolvePluginTabIcon('not-a-real-icon')).toBe(faPuzzlePiece);
  });
});
