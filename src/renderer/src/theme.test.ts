import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersMoreContrast, shouldUseHighContrastTheme } from '#/renderer/src/theme';

/**
 * Installs a stub for `window.matchMedia` used by contrast-preference detection.
 *
 * @param matches - Whether `(prefers-contrast: more)` should match.
 */
function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('window', {
    matchMedia: vi.fn(() => ({
      matches,
      media: '(prefers-contrast: more)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  });
}

describe('shouldUseHighContrastTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('activates for an explicit high-contrast preference', () => {
    stubMatchMedia(false);
    expect(shouldUseHighContrastTheme('high-contrast')).toBe(true);
  });

  it('activates for system theme when the OS prefers more contrast', () => {
    stubMatchMedia(true);
    expect(shouldUseHighContrastTheme('system')).toBe(true);
  });

  it('does not override explicit light or dark selections', () => {
    stubMatchMedia(true);
    expect(shouldUseHighContrastTheme('light')).toBe(false);
    expect(shouldUseHighContrastTheme('dark')).toBe(false);
  });

  it('reports OS contrast preference via prefersMoreContrast', () => {
    stubMatchMedia(true);
    expect(prefersMoreContrast()).toBe(true);
  });
});
