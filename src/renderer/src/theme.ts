import type { BuiltinThemeId } from '#/shared/builtinThemes';
import type { ThemeSource } from '#/shared/types';

/**
 * Returns whether the OS requests increased contrast via `prefers-contrast: more`.
 *
 * @returns True when the user agent reports a stronger contrast preference.
 */
export function prefersMoreContrast(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Returns whether the OS prefers a dark color scheme.
 *
 * @returns True when `prefers-color-scheme: dark` matches.
 */
export function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Determines whether the renderer should apply the high-contrast CSS override.
 *
 * Explicit `high-contrast` selections always win. When the user chooses
 * `system`, the OS contrast preference can opt into high contrast without
 * changing the persisted setting.
 *
 * @param theme - Persisted theme preference.
 * @returns True when `data-theme="high-contrast"` should be set on the root.
 */
export function shouldUseHighContrastTheme(theme: ThemeSource): boolean {
  if (theme === 'high-contrast') {
    return true;
  }

  if (theme === 'system' && prefersMoreContrast()) {
    return true;
  }

  return false;
}

/**
 * Resolves the built-in palette id that System should apply from OS preferences.
 *
 * @returns Built-in theme id for the current system appearance.
 */
export function resolveSystemBuiltinTheme(): BuiltinThemeId {
  if (shouldUseHighContrastTheme('system')) {
    return 'high-contrast';
  }

  if (prefersDarkColorScheme()) {
    return 'dark';
  }

  return 'light';
}

/**
 * Applies the renderer theme attribute on the document root so CSS overrides
 * can target high-contrast mode without relying on nativeTheme alone.
 *
 * Explicit light and dark selections set `data-theme` so palettes apply even
 * when `prefers-color-scheme` does not follow Electron nativeTheme (for example
 * under Playwright automation). System theme omits the attribute and uses OS
 * color-scheme media queries instead.
 *
 * @param theme - Persisted theme preference.
 */
export function applyThemeAttribute(theme: ThemeSource): void {
  if (shouldUseHighContrastTheme(theme)) {
    document.documentElement.setAttribute('data-theme', 'high-contrast');
    return;
  }

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    return;
  }

  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    return;
  }

  document.documentElement.removeAttribute('data-theme');
}

/**
 * Subscribes to OS contrast-preference changes and reapplies the theme attribute.
 *
 * @param getTheme - Loads the persisted theme preference.
 * @param onApply - Called with the latest theme when contrast preference changes.
 * @returns Cleanup function that removes the media-query listener.
 */
export function subscribeContrastPreferenceChanges(
  getTheme: () => Promise<ThemeSource>,
  onApply: (theme: ThemeSource) => void
): () => void {
  const mediaQuery = window.matchMedia('(prefers-contrast: more)');

  /**
   * Re-reads the persisted theme and reapplies the CSS override.
   */
  const handleChange = (): void => {
    void getTheme().then(onApply);
  };

  mediaQuery.addEventListener('change', handleChange);

  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}

/**
 * Subscribes to OS color-scheme changes and reapplies the theme when System is active.
 *
 * @param getTheme - Loads the persisted theme preference.
 * @param onApply - Called when the system theme should be reapplied.
 * @returns Cleanup function that removes the media-query listener.
 */
export function subscribeColorSchemePreferenceChanges(
  getTheme: () => Promise<ThemeSource>,
  onApply: () => void
): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /**
   * Reapplies the system theme when the OS color scheme changes.
   */
  const handleChange = (): void => {
    void getTheme().then((theme) => {
      if (theme === 'system') {
        onApply();
      }
    });
  };

  mediaQuery.addEventListener('change', handleChange);

  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}
