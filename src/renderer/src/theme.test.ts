import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemeAttribute,
  prefersMoreContrast,
  resolveSystemBuiltinTheme,
  shouldUseHighContrastTheme
} from '#/renderer/src/theme';

/**
 * Installs a stub for `window.matchMedia` used by contrast-preference detection.
 *
 * @param options - Media query match results.
 */
function stubMatchMedia(options: { prefersContrastMore?: boolean; prefersDark?: boolean }): void {
  vi.stubGlobal('window', {
    matchMedia: vi.fn((query: string) => ({
      matches:
        query === '(prefers-contrast: more)'
          ? (options.prefersContrastMore ?? false)
          : query === '(prefers-color-scheme: dark)'
            ? (options.prefersDark ?? false)
            : false,
      media: query,
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
    stubMatchMedia({});
    expect(shouldUseHighContrastTheme('high-contrast')).toBe(true);
  });

  it('activates for system theme when the OS prefers more contrast', () => {
    stubMatchMedia({ prefersContrastMore: true });
    expect(shouldUseHighContrastTheme('system')).toBe(true);
  });

  it('does not override explicit light or dark selections', () => {
    stubMatchMedia({ prefersContrastMore: true });
    expect(shouldUseHighContrastTheme('light')).toBe(false);
    expect(shouldUseHighContrastTheme('dark')).toBe(false);
  });

  it('reports OS contrast preference via prefersMoreContrast', () => {
    stubMatchMedia({ prefersContrastMore: true });
    expect(prefersMoreContrast()).toBe(true);
  });
});

describe('resolveSystemBuiltinTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves to high contrast when the OS prefers more contrast', () => {
    stubMatchMedia({ prefersContrastMore: true, prefersDark: false });
    expect(resolveSystemBuiltinTheme()).toBe('high-contrast');
  });

  it('resolves to dark when the OS prefers a dark color scheme', () => {
    stubMatchMedia({ prefersContrastMore: false, prefersDark: true });
    expect(resolveSystemBuiltinTheme()).toBe('dark');
  });

  it('resolves to light when the OS prefers a light color scheme', () => {
    stubMatchMedia({ prefersContrastMore: false, prefersDark: false });
    expect(resolveSystemBuiltinTheme()).toBe('light');
  });
});

describe('applyThemeAttribute', () => {
  interface StubElement {
    attributes: Record<string, string>;
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    removeAttribute(name: string): void;
  }

  let root: StubElement;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Installs a minimal document stub for data-theme attribute tests.
   */
  function stubDocument(): void {
    root = {
      attributes: {},
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
      getAttribute(name: string) {
        return this.attributes[name] ?? null;
      },
      hasAttribute(name: string) {
        return Object.hasOwn(this.attributes, name);
      },
      removeAttribute(name: string) {
        delete this.attributes[name];
      }
    };
    vi.stubGlobal('document', { documentElement: root });
  }

  it('sets data-theme for explicit dark and light selections', () => {
    stubDocument();
    applyThemeAttribute('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');

    applyThemeAttribute('light');
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('removes data-theme for system preference', () => {
    stubDocument();
    applyThemeAttribute('dark');
    applyThemeAttribute('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});
