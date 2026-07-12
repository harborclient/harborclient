import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAppearanceDark } from '#/renderer/src/appearanceTheme';

interface StubElement {
  attributes: Record<string, string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

/**
 * Installs stubs for `document` and `window.matchMedia` used by appearance detection.
 *
 * @param options - Root theme attribute and computed color-scheme.
 */
function stubAppearance(options: {
  dataTheme?: string | null;
  colorScheme?: string;
  prefersDark?: boolean;
}): StubElement {
  const root: StubElement = {
    attributes: {},
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    getAttribute(name: string) {
      if (name === 'data-theme') {
        return options.dataTheme === undefined ? null : options.dataTheme;
      }
      return this.attributes[name] ?? null;
    }
  };

  if (options.dataTheme != null) {
    root.setAttribute('data-theme', options.dataTheme);
  }

  vi.stubGlobal('document', {
    documentElement: root
  });

  vi.stubGlobal(
    'getComputedStyle',
    vi.fn(() => ({
      colorScheme: options.colorScheme ?? 'light'
    }))
  );

  vi.stubGlobal('window', {
    matchMedia: vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? (options.prefersDark ?? false) : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })),
    getComputedStyle: vi.fn(() => ({
      colorScheme: options.colorScheme ?? 'light'
    }))
  });

  return root;
}

describe('isAppearanceDark', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false for explicit light theme', () => {
    stubAppearance({ dataTheme: 'light', prefersDark: true });
    expect(isAppearanceDark()).toBe(false);
  });

  it('returns true for explicit dark theme', () => {
    stubAppearance({ dataTheme: 'dark' });
    expect(isAppearanceDark()).toBe(true);
  });

  it('returns true for high-contrast theme', () => {
    stubAppearance({ dataTheme: 'high-contrast' });
    expect(isAppearanceDark()).toBe(true);
  });

  it('reads color-scheme for custom themes', () => {
    stubAppearance({ dataTheme: 'custom', colorScheme: 'dark' });
    expect(isAppearanceDark()).toBe(true);

    stubAppearance({ dataTheme: 'custom', colorScheme: 'light' });
    expect(isAppearanceDark()).toBe(false);
  });

  it('reads color-scheme for plugin themes', () => {
    stubAppearance({ dataTheme: 'plugin-foo-bar', colorScheme: 'dark only' });
    expect(isAppearanceDark()).toBe(true);
  });

  it('falls back to OS preference when data-theme is absent (system)', () => {
    stubAppearance({ dataTheme: null, prefersDark: true });
    expect(isAppearanceDark()).toBe(true);

    stubAppearance({ dataTheme: null, prefersDark: false });
    expect(isAppearanceDark()).toBe(false);
  });
});
