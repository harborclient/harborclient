import { z } from 'zod';

/**
 * Optional CSS color assigned to a sidebar item for visual grouping.
 */
export type SidebarItemColor = string | null | undefined;

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
export function readSidebarColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
