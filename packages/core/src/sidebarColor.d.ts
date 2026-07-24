import { z } from 'zod';
/**
 * Optional CSS color assigned to a sidebar item for visual grouping.
 */
export type SidebarItemColor = string | null | undefined;
/**
 * Zod schema for an optional sidebar item color in export files.
 */
export declare const optionalSidebarColor: z.ZodPipe<
  z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>,
  z.ZodTransform<string | null, string | null | undefined>
>;
/**
 * Normalizes a raw database or JSON value to a sidebar color or null.
 *
 * @param value - Stored color string or null/undefined.
 */
export declare function readSidebarColor(value: unknown): string | null;
//# sourceMappingURL=sidebarColor.d.ts.map
