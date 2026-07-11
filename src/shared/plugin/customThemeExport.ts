import { z } from 'zod';
import type {
  CustomTheme,
  CustomThemeExport,
  CustomThemeImportDraft,
  CustomThemeType
} from '#/shared/types/customTheme';
import type { ThemeSource } from '#/shared/types/settings';

const customThemeTypeSchema = z.enum(['light', 'dark', 'high-contrast']);

const themeColorTokenSchema = z.enum([
  'surface',
  'sidebar',
  'sidebar-section',
  'control',
  'field',
  'separator',
  'text',
  'text-secondary',
  'muted',
  'accent',
  'selection',
  'tab-unsaved',
  'danger',
  'danger-light',
  'warning',
  'success',
  'info',
  'method-get',
  'method-post',
  'method-put',
  'method-patch',
  'method-delete',
  'method-head',
  'method-options',
  'scrollbar-track',
  'scrollbar-thumb',
  'scrollbar-thumb-hover',
  'scrollbar-thumb-active',
  'script-stage-before-all',
  'script-stage-before-each',
  'script-stage-main',
  'script-stage-after-each',
  'script-stage-after-all'
]);

const customThemeIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .min(1)
  .max(128);

const themeColorsRecordSchema = z
  .record(z.string(), z.string().min(1))
  .superRefine((colors, ctx) => {
    for (const key of Object.keys(colors)) {
      if (!themeColorTokenSchema.safeParse(key).success) {
        ctx.addIssue({
          code: 'custom',
          message: `Unknown theme token: ${key}`
        });
      }
    }
  });

/**
 * Zod schema for saving a custom theme from the Creator form.
 */
export const customThemeSaveInputSchema = z.object({
  id: customThemeIdSchema.optional(),
  title: z.string().trim().min(1),
  type: customThemeTypeSchema,
  colors: themeColorsRecordSchema
});

/**
 * Zod schema for portable custom theme export files.
 */
export const customThemeExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('theme'),
  theme: themeColorsRecordSchema,
  title: z.string().trim().min(1),
  type: customThemeTypeSchema
}) satisfies z.ZodType<CustomThemeExport>;

/**
 * Validates a parsed JSON object as a custom theme export file.
 *
 * @param data - Raw parsed JSON from disk or an import dialog.
 * @returns Validated export envelope.
 * @throws When the file is not a valid theme export.
 */
export function validateCustomThemeExport(data: unknown): CustomThemeExport {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid theme file: expected a JSON object');
  }

  const result = customThemeExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid theme file: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Converts a stored custom theme to its on-disk export envelope.
 *
 * @param theme - Custom theme with id and palette values.
 * @returns Portable export envelope without the id field.
 */
export function customThemeToEnvelope(theme: CustomTheme): CustomThemeExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'theme',
    theme: theme.colors,
    title: theme.title,
    type: theme.type
  };
}

/**
 * Converts a validated export envelope and filename stem into a custom theme record.
 *
 * @param id - Filename stem for the theme.
 * @param envelope - Validated export envelope.
 * @returns Custom theme record for renderer and IPC consumers.
 */
export function envelopeToCustomTheme(id: string, envelope: CustomThemeExport): CustomTheme {
  return {
    id,
    title: envelope.title,
    type: envelope.type,
    colors: envelope.theme
  };
}

/**
 * Converts an import draft from a validated export envelope.
 *
 * @param envelope - Validated export envelope.
 * @returns Draft values for the Creator form without saving.
 */
export function envelopeToImportDraft(envelope: CustomThemeExport): CustomThemeImportDraft {
  return {
    title: envelope.title,
    type: envelope.type,
    colors: envelope.theme
  };
}

/**
 * Serializes a custom theme id into a persisted theme preference value.
 *
 * @param id - Custom theme filename stem.
 * @returns Theme source string stored via theme:get/set.
 */
export function formatCustomThemeValue(id: string): ThemeSource {
  return `custom:${id}`;
}

/**
 * Parses a persisted custom theme preference.
 *
 * @param value - Raw theme setting from storage.
 * @returns Custom theme id when the value is custom-scoped.
 */
export function parseCustomThemeSource(value: string): { id: string } | null {
  const match = /^custom:([^/\\]+)$/.exec(value);
  if (!match) {
    return null;
  }
  return { id: match[1] };
}

/**
 * Returns whether a string is a valid custom theme id for filenames.
 *
 * @param id - Candidate filename stem.
 * @returns True when the id is safe to use as `<id>.json`.
 */
export function isValidCustomThemeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 128;
}

/**
 * Type guard for custom theme appearance values.
 *
 * @param value - Candidate appearance mode.
 * @returns True when the value is a supported custom theme type.
 */
export function isCustomThemeType(value: string): value is CustomThemeType {
  return value === 'light' || value === 'dark' || value === 'high-contrast';
}
