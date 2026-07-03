import type { ThemeSource } from '#/shared/types';

const BUILTIN_THEME_SOURCES = new Set<ThemeSource>(['light', 'dark', 'system', 'high-contrast']);

/**
 * Normalizes a raw `--theme` argument into a built-in theme id when possible.
 *
 * @param raw - Unparsed theme value from argv.
 * @returns Canonical built-in theme id, or null when unsupported.
 */
function normalizeStartupThemeArg(raw: string): ThemeSource | null {
  const normalized = raw.trim().toLowerCase().replace(/_/g, ' ');
  const canonical =
    normalized === 'high contrast' ? 'high-contrast' : normalized.replace(/\s+/g, '-');

  if (BUILTIN_THEME_SOURCES.has(canonical as ThemeSource)) {
    return canonical as ThemeSource;
  }

  return null;
}

/**
 * Reads `process.argv` for `--theme` so the flag works in both dev and packaged builds.
 *
 * @param argv - Process argv including Electron flags.
 * @returns Built-in theme override for this session, or null when unset or invalid.
 */
export function parseStartupThemeFlag(argv: string[] = process.argv): ThemeSource | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--theme=')) {
      const value = arg.slice('--theme='.length);
      const theme = normalizeStartupThemeArg(value);
      if (theme == null) {
        console.warn(`Ignoring unsupported --theme value: ${value}`);
      }
      return theme;
    }
    if (arg === '--theme' && argv[index + 1]) {
      const value = argv[index + 1];
      const theme = normalizeStartupThemeArg(value);
      if (theme == null) {
        console.warn(`Ignoring unsupported --theme value: ${value}`);
      }
      return theme;
    }
  }

  return null;
}

const startupThemeOverride = parseStartupThemeFlag();

/**
 * Returns the session-only theme override from `--theme`, when present.
 *
 * @returns Built-in theme for this launch, or null to use persisted Settings.
 */
export function getStartupThemeOverride(): ThemeSource | null {
  return startupThemeOverride;
}
