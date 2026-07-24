import { z } from 'zod';
/**
 * Zod schema for an optional sidebar item color in export files.
 */
export const optionalSidebarColor = z
  .union([z.string().trim().min(1), z.null()])
  .optional()
  .transform((value) => (value == null || value === '' ? null : value));
/**
 * Normalizes a raw database or JSON value to a sidebar color or null.
 *
 * @param value - Stored color string or null/undefined.
 */
export function readSidebarColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
//# sourceMappingURL=sidebarColor.js.map
