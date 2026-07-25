/**
 * Default preset swatches for sidebar item color coding (two rows of five).
 */
export const DEFAULT_COLOR_PICKER_PRESETS: readonly string[] = [
  '#1e3a5f',
  '#0d9488',
  '#ca8a04',
  '#b91c1c',
  '#be185d',
  '#3b82f6',
  '#16a34a',
  '#ea580c',
  '#dc2626',
  '#9333ea'
] as const;

/** Number of user-defined custom swatch slots in the picker grid. */
export const CUSTOM_SWATCH_SLOT_COUNT = 5;

/**
 * Normalizes a CSS color string to lowercase hex when possible.
 *
 * @param value - Raw color string from storage or user input.
 * @returns Normalized color for comparison, or the trimmed input.
 */
export function normalizeCssColor(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns whether two CSS color strings represent the same color.
 *
 * @param a - First color string.
 * @param b - Second color string.
 */
export function colorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) {
    return false;
  }
  return normalizeCssColor(a) === normalizeCssColor(b);
}

/**
 * Coerces a stored value to a valid hex color for native color inputs (`#rrggbb`).
 *
 * @param value - CSS color string.
 * @returns Hex suitable for `<input type="color">`, or `#808080` when unrecognized.
 */
export function toHexColorInputValue(value: string | null | undefined): string {
  if (value == null || value.trim() === '') {
    return '#808080';
  }

  const trimmed = value.trim();
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
    }
    return `#${hex.toLowerCase()}`;
  }

  return '#808080';
}
