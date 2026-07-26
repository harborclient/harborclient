import { z } from 'zod';

/**
 * Optional sidebar marker (CSS color string) assigned for visual grouping.
 */
export type SidebarItemMarker = string | null | undefined;

/**
 * Zod schema for an optional sidebar item marker in export files.
 */
export const optionalSidebarMarker = z
  .union([z.string().trim().min(1), z.null()])
  .optional()
  .transform((value) => (value == null || value === '' ? null : value));

/**
 * Normalizes a raw database or JSON value to a sidebar marker or null.
 *
 * @param value - Stored marker string or null/undefined.
 */
export function readSidebarMarker(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
