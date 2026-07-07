import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import {
  customThemeToEnvelope,
  envelopeToCustomTheme,
  isValidCustomThemeId,
  validateCustomThemeExport
} from '#/shared/plugin/customThemeExport';
import type { CustomTheme } from '#/shared/types/customTheme';

/** Directory name under userData where custom themes are stored. */
export const CUSTOM_THEMES_DIR_NAME = 'custom_themes';

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
    return envelopeToCustomTheme(id, envelope);
  } catch {
    return null;
  }
}

/**
 * Lists all valid custom themes stored on disk, sorted by title.
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

  return themes.sort((left, right) => left.title.localeCompare(right.title));
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
  return theme;
}

/**
 * Deletes one custom theme file from disk.
 *
 * @param id - Filename stem for the theme.
 * @throws When the id is invalid or the file does not exist.
 */
export function deleteCustomTheme(id: string): void {
  if (!isValidCustomThemeId(id)) {
    throw new Error('Invalid custom theme id');
  }

  const filePath = join(getCustomThemesDirectory(), `${id}.json`);
  if (!existsSync(filePath)) {
    throw new Error('Custom theme not found');
  }

  rmSync(filePath);
}
