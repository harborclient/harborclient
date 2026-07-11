import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { BUILTIN_THEME_IDS, isBuiltinThemeId, type BuiltinThemeId } from '#/shared/builtinThemes';
import {
  customThemeToEnvelope,
  envelopeToCustomTheme,
  isValidCustomThemeId,
  validateCustomThemeExport
} from '#/shared/plugin/customThemeExport';
import type { CustomTheme, CustomThemeExport } from '#/shared/types/customTheme';

/** Directory name under userData where custom themes are stored. */
export const CUSTOM_THEMES_DIR_NAME = 'custom_themes';

/**
 * Returns candidate directories for packaged built-in theme resources.
 *
 * @returns Ordered search paths for canonical built-in theme JSON files.
 */
export function getBuiltinThemesResourceDirectories(): string[] {
  const directories = new Set<string>();

  if (app.isPackaged) {
    directories.add(join(process.resourcesPath, 'builtin_themes'));
  }

  directories.add(join(app.getAppPath(), 'resources/builtin_themes'));
  directories.add(join(__dirname, '../../resources/builtin_themes'));

  return [...directories];
}

/**
 * Loads one canonical built-in theme export from packaged resources.
 *
 * @param id - Reserved built-in theme filename stem.
 * @returns Validated export envelope from app resources.
 * @throws When the canonical file is missing or invalid.
 */
export function loadCanonicalBuiltinThemeExport(id: BuiltinThemeId): CustomThemeExport {
  for (const directory of getBuiltinThemesResourceDirectories()) {
    const filePath = join(directory, `${id}.json`);
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    return validateCustomThemeExport(parsed);
  }

  throw new Error(`Canonical built-in theme not found: ${id}`);
}

/**
 * Attaches built-in metadata to a stored theme record when applicable.
 *
 * @param theme - Parsed custom theme from disk.
 * @returns Theme record with `builtin` set for reserved ids.
 */
function withBuiltinMetadata(theme: CustomTheme): CustomTheme {
  if (!isBuiltinThemeId(theme.id)) {
    return theme;
  }

  return {
    ...theme,
    builtin: true
  };
}

/**
 * Returns the absolute path to the custom themes directory, creating it when missing.
 *
 * @returns Absolute path to `{userData}/custom_themes`.
 */
export function getCustomThemesDirectory(): string {
  const directory = join(app.getPath('userData'), CUSTOM_THEMES_DIR_NAME);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  return directory;
}

/**
 * Reads and validates one custom theme file from disk.
 *
 * @param id - Filename stem for the theme.
 * @returns Parsed custom theme or null when the file is missing or invalid.
 */
export function getCustomTheme(id: string): CustomTheme | null {
  if (!isValidCustomThemeId(id)) {
    return null;
  }

  const filePath = join(getCustomThemesDirectory(), `${id}.json`);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    const envelope = validateCustomThemeExport(parsed);
    return withBuiltinMetadata(envelopeToCustomTheme(id, envelope));
  } catch {
    return null;
  }
}

/**
 * Lists all valid custom themes stored on disk, sorted with built-ins first then title.
 *
 * @returns Custom themes parsed from `{userData}/custom_themes/*.json`.
 */
export function listCustomThemes(): CustomTheme[] {
  const directory = getCustomThemesDirectory();
  const entries = readdirSync(directory, { withFileTypes: true });
  const themes: CustomTheme[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const id = entry.name.slice(0, -'.json'.length);
    const theme = getCustomTheme(id);
    if (theme) {
      themes.push(theme);
    }
  }

  return themes.sort((left, right) => {
    const leftBuiltin = left.builtin === true;
    const rightBuiltin = right.builtin === true;
    if (leftBuiltin !== rightBuiltin) {
      return leftBuiltin ? -1 : 1;
    }

    if (leftBuiltin && rightBuiltin) {
      return (
        BUILTIN_THEME_IDS.indexOf(left.id as BuiltinThemeId) -
        BUILTIN_THEME_IDS.indexOf(right.id as BuiltinThemeId)
      );
    }

    return left.title.localeCompare(right.title);
  });
}

/**
 * Input for saving a custom theme to disk.
 */
export interface SaveCustomThemeInput {
  /**
   * Existing filename stem. Omitted when creating a new theme.
   */
  id?: string;

  /**
   * Human-readable theme title.
   */
  title: string;

  /**
   * Base appearance mode.
   */
  type: CustomTheme['type'];

  /**
   * Token overrides without the `--mac-` prefix.
   */
  colors: CustomTheme['colors'];
}

/**
 * Writes a custom theme export file to disk.
 *
 * @param input - Theme values to persist.
 * @returns Saved custom theme including its id.
 */
export function saveCustomTheme(input: SaveCustomThemeInput): CustomTheme {
  const id = input.id && isValidCustomThemeId(input.id) ? input.id : randomUUID();
  const theme: CustomTheme = {
    id,
    title: input.title.trim(),
    type: input.type,
    colors: input.colors
  };

  if (!theme.title) {
    throw new Error('Theme title is required');
  }

  const filePath = join(getCustomThemesDirectory(), `${id}.json`);
  writeFileSync(filePath, `${JSON.stringify(customThemeToEnvelope(theme), null, 2)}\n`, 'utf-8');
  return withBuiltinMetadata(theme);
}

/**
 * Seeds missing built-in theme files into `{userData}/custom_themes`.
 *
 * Existing built-in files are left untouched so Designer edits survive restarts.
 */
export function seedMissingBuiltinThemes(): void {
  for (const id of BUILTIN_THEME_IDS) {
    const filePath = join(getCustomThemesDirectory(), `${id}.json`);
    if (existsSync(filePath)) {
      continue;
    }

    const envelope = loadCanonicalBuiltinThemeExport(id);
    saveCustomTheme({
      id,
      title: envelope.title,
      type: envelope.type,
      colors: envelope.theme
    });
  }
}

/**
 * Restores one built-in theme file from its packaged canonical export.
 *
 * @param id - Reserved built-in theme filename stem.
 * @returns Restored built-in theme record.
 * @throws When the id is not a built-in theme.
 */
export function restoreBuiltinTheme(id: string): CustomTheme {
  if (!isBuiltinThemeId(id)) {
    throw new Error('Only built-in themes can be restored');
  }

  const envelope = loadCanonicalBuiltinThemeExport(id);
  return saveCustomTheme({
    id,
    title: envelope.title,
    type: envelope.type,
    colors: envelope.theme
  });
}

/**
 * Deletes one custom theme file from disk.
 *
 * @param id - Filename stem for the theme.
 * @throws When the id is invalid, protected, or the file does not exist.
 */
export function deleteCustomTheme(id: string): void {
  if (!isValidCustomThemeId(id)) {
    throw new Error('Invalid custom theme id');
  }

  if (isBuiltinThemeId(id)) {
    throw new Error('Built-in themes cannot be deleted');
  }

  const filePath = join(getCustomThemesDirectory(), `${id}.json`);
  if (!existsSync(filePath)) {
    throw new Error('Custom theme not found');
  }

  rmSync(filePath);
}
