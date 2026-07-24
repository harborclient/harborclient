import type { RgbaColor } from 'react-colorful';

/**
 * Parses a CSS color string into an RGBA object for react-colorful.
 *
 * Supports `#rgb`, `#rrggbb`, and `rgba(r, g, b, a)` forms used by theme tokens.
 *
 * @param value - CSS color string from a theme token.
 * @returns Parsed RGBA values or null when the string is not recognized.
 */
export function parseCssColor(value: string): RgbaColor | null {
  const trimmed = value.trim();
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    }
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 1
    };
  }

  const rgbaMatch =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(trimmed);
  if (rgbaMatch) {
    return {
      r: Math.round(Number(rgbaMatch[1])),
      g: Math.round(Number(rgbaMatch[2])),
      b: Math.round(Number(rgbaMatch[3])),
      a: rgbaMatch[4] == null ? 1 : Number(rgbaMatch[4])
    };
  }

  return null;
}

/**
 * Formats an RGBA object as a CSS color string.
 *
 * Opaque colors use `#rrggbb`; translucent colors use `rgba(r, g, b, a)`.
 *
 * @param color - RGBA values from react-colorful.
 * @returns CSS color string suitable for theme token storage.
 */
export function formatCssColor(color: RgbaColor): string {
  const clamped = {
    r: Math.max(0, Math.min(255, Math.round(color.r))),
    g: Math.max(0, Math.min(255, Math.round(color.g))),
    b: Math.max(0, Math.min(255, Math.round(color.b))),
    a: Math.max(0, Math.min(1, color.a))
  };

  if (clamped.a >= 1) {
    const toHex = (channel: number): string => channel.toString(16).padStart(2, '0');
    return `#${toHex(clamped.r)}${toHex(clamped.g)}${toHex(clamped.b)}`;
  }

  const alpha = Number(clamped.a.toFixed(2));
  return `rgba(${clamped.r}, ${clamped.g}, ${clamped.b}, ${alpha})`;
}

/**
 * Returns a fallback RGBA color when a token value cannot be parsed.
 */
export const FALLBACK_RGBA_COLOR: RgbaColor = { r: 128, g: 128, b: 128, a: 1 };
