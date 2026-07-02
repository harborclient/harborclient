import { describe, expect, it } from 'vitest';
import { isPickThemeFlagEnabled } from '#/main/pickTheme';

describe('isPickThemeFlagEnabled', () => {
  it('returns true when --pick-theme is present', () => {
    expect(isPickThemeFlagEnabled(['electron', '--pick-theme'])).toBe(true);
  });

  it('returns false when --pick-theme is absent', () => {
    expect(isPickThemeFlagEnabled(['electron', '--verbose'])).toBe(false);
  });
});
