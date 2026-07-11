import type { BrowserWindow } from 'electron';
import { isBuiltinThemeId } from '#/shared/builtinThemes';
import { listCustomThemes, saveCustomTheme } from '#/main/storage/customThemes';
import { confirmDuplicateImport } from '#/main/ipc/handlers/importDialogs';
import { validateCustomThemeExport } from '#/shared/plugin/customThemeExport';
import type { CustomTheme } from '#/shared/types/customTheme';
import type { ImportAction } from '#/shared/types';

/**
 * Result of importing a custom theme from a portable export file.
 */
export interface CustomThemeImportResult {
  /**
   * Imported or updated custom theme.
   */
  theme: CustomTheme;

  /**
   * Whether a new theme was created or an existing one was updated.
   */
  action: ImportAction;
}

/**
 * Looks up a saved custom theme by exact trimmed title.
 *
 * @param title - Theme title from an export envelope.
 * @returns Matching theme, or undefined when not found.
 */
function findExistingThemeByTitle(title: string): CustomTheme | undefined {
  const trimmedTitle = title.trim();
  return listCustomThemes().find(
    (theme) => !isBuiltinThemeId(theme.id) && theme.title.trim() === trimmedTitle
  );
}

/**
 * Persists an imported custom theme export, deduplicating by title when present.
 *
 * @param win - Focused browser window for duplicate-import prompts, if any.
 * @param parsed - Parsed JSON from a theme export file.
 * @returns The created or updated theme with action, or null when canceled.
 */
export async function importCustomThemeData(
  win: BrowserWindow | null,
  parsed: unknown
): Promise<CustomThemeImportResult | null> {
  const envelope = validateCustomThemeExport(parsed);
  const existing = findExistingThemeByTitle(envelope.title);

  if (existing) {
    const choice = await confirmDuplicateImport(win, 'theme', existing.title);
    if (choice === 'cancel') {
      return null;
    }
    if (choice === 'update') {
      const theme = saveCustomTheme({
        id: existing.id,
        title: envelope.title,
        type: envelope.type,
        colors: envelope.theme
      });
      return { theme, action: 'updated' };
    }
  }

  const theme = saveCustomTheme({
    title: envelope.title,
    type: envelope.type,
    colors: envelope.theme
  });
  return { theme, action: 'created' };
}
