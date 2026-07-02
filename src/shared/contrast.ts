/**
 * Parses a six-digit hex color into sRGB channel values in the 0–1 range.
 *
 * @param hex - Color such as `#ffffff` or `ffffff`.
 * @returns Normalized red, green, and blue channels.
 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) {
    throw new Error(`Expected 6-digit hex color, received "${hex}"`);
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  return { r, g, b };
}

/**
 * Applies the WCAG relative luminance transfer function to a single sRGB channel.
 *
 * @param channel - Normalized sRGB channel value between 0 and 1.
 * @returns Linearized luminance component.
 */
function linearizeChannel(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * Computes WCAG 2.x relative luminance for a hex color.
 *
 * @param hex - Six-digit sRGB hex color.
 * @returns Relative luminance between 0 and 1.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const red = linearizeChannel(r);
  const green = linearizeChannel(g);
  const blue = linearizeChannel(b);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Computes the WCAG contrast ratio between two hex colors.
 *
 * @param foreground - Foreground hex color.
 * @param background - Background hex color.
 * @returns Contrast ratio between 1 and 21.
 */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}
