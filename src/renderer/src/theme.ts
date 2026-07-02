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
 * Applies the renderer theme attribute on the document root so CSS overrides
 * can target high-contrast mode without relying on nativeTheme alone.
 *
 * @param theme - Persisted theme preference.
 */
export function applyThemeAttribute(theme: ThemeSource): void {
  if (shouldUseHighContrastTheme(theme)) {
    document.documentElement.setAttribute('data-theme', 'high-contrast');
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
