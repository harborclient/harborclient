import { prefersDarkColorScheme } from './theme';

/**
 * Returns whether the active appearance theme resolves to a dark color scheme.
 *
 * Mirrors the CSS rules in `styles.css`: explicit light is always light; explicit
 * dark and high-contrast are dark; custom and plugin themes read `color-scheme`
 * from injected styles; system theme falls back to the OS preference.
 *
 * @returns True when markdown and other surfaces should use dark styling.
 */
export function isAppearanceDark(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const dataTheme = document.documentElement.getAttribute('data-theme');

  if (dataTheme === 'light') {
    return false;
  }

  if (dataTheme === 'dark' || dataTheme === 'high-contrast') {
    return true;
  }

  if (dataTheme === 'custom' || (dataTheme != null && dataTheme.startsWith('plugin-'))) {
    const colorScheme = getComputedStyle(document.documentElement).colorScheme;
    return colorScheme.includes('dark');
  }

  return prefersDarkColorScheme();
}
