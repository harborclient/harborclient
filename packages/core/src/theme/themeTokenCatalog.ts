import type { ThemeColorToken, ThemeMetricToken } from '@harborclient/sdk';
import hcThemeJson from './hc_theme.json';

/**
 * Kind of theme token — color palette or typography/geometry metric.
 */
export type ThemeTokenKind = 'color' | 'metric';

/**
 * Built-in default values for one theme token across appearance modes.
 */
export interface ThemeTokenDefaults {
  /**
   * Default CSS value for the light palette.
   */
  light: string;

  /**
   * Default CSS value for the dark palette.
   */
  dark: string;

  /**
   * Default CSS value for the high-contrast palette.
   */
  highContrast: string;
}

/**
 * One `--mac-*` theme token entry from the generated catalog.
 */
export interface ThemeTokenCatalogEntry {
  /**
   * CSS custom property name including the `--mac-` prefix.
   */
  name: string;

  /**
   * Token id without the `--mac-` prefix (SDK `ThemeColorToken` or `ThemeMetricToken`).
   */
  token: string;

  /**
   * Whether this token is a color or a metric.
   */
  kind: ThemeTokenKind;

  /**
   * Designer category group label.
   */
  group: string;

  /**
   * Human-readable Designer field label.
   */
  label: string;

  /**
   * Short description of what the token styles.
   */
  description: string;

  /**
   * Built-in default values for light, dark, and high-contrast modes.
   */
  defaults: ThemeTokenDefaults;
}

/**
 * Raw JSON shape of {@link ./hc_theme.json} keyed by `--mac-*` name.
 */
type ThemeTokenManifest = Record<string, ThemeTokenCatalogEntry>;

const manifest = hcThemeJson as ThemeTokenManifest;

/**
 * Ordered catalog of every `--mac-*` theme token (colors then metrics, Designer order).
 */
export const THEME_TOKEN_CATALOG: readonly ThemeTokenCatalogEntry[] = Object.values(manifest);

/**
 * Lookup map from bare token id to catalog entry.
 */
const byToken = new Map<string, ThemeTokenCatalogEntry>(
  THEME_TOKEN_CATALOG.map((entry) => [entry.token, entry])
);

/**
 * Lookup map from lowercase CSS variable name to catalog entry.
 */
const byName = new Map<string, ThemeTokenCatalogEntry>(
  THEME_TOKEN_CATALOG.map((entry) => [entry.name.toLowerCase(), entry])
);

/**
 * Returns the full theme token catalog in Designer display order.
 *
 * @returns Readonly array of catalog entries.
 */
export function listThemeTokenCatalog(): readonly ThemeTokenCatalogEntry[] {
  return THEME_TOKEN_CATALOG;
}

/**
 * Looks up a catalog entry by bare token id (without `--mac-` prefix).
 *
 * @param token - Token id such as `surface` or `layout-font-size`.
 * @returns Matching catalog entry, or undefined when unknown.
 */
export function getThemeTokenCatalogEntry(token: string): ThemeTokenCatalogEntry | undefined {
  return byToken.get(token);
}

/**
 * Normalizes agent/user token input to a bare catalog token id.
 *
 * Accepts bare ids (`surface`), CSS variable names (`--mac-surface`), and
 * case-insensitive variants. Returns the canonical token id from the catalog.
 *
 * @param input - Raw token string from a tool argument.
 * @returns Canonical token id without the `--mac-` prefix.
 * @throws When the input is empty or does not match a known catalog token.
 */
export function normalizeThemeTokenInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Theme token is required.');
  }

  const lower = trimmed.toLowerCase();
  const asName = lower.startsWith('--mac-') ? lower : `--mac-${lower}`;
  const byCss = byName.get(asName);
  if (byCss) {
    return byCss.token;
  }

  const bare = lower.startsWith('--mac-') ? lower.slice('--mac-'.length) : lower;
  const byId = byToken.get(bare);
  if (byId) {
    return byId.token;
  }

  // Preserve original casing when matching exact catalog token ids that may
  // differ only by case from the lowercased lookup (catalog tokens are lowercase).
  const exact = byToken.get(trimmed);
  if (exact) {
    return exact.token;
  }

  throw new Error(`Unknown theme token: ${trimmed}`);
}

/**
 * Returns whether a token id is a color token in the catalog.
 *
 * @param token - Bare token id.
 */
export function isThemeColorToken(token: string): token is ThemeColorToken {
  return byToken.get(token)?.kind === 'color';
}

/**
 * Returns whether a token id is a metric token in the catalog.
 *
 * @param token - Bare token id.
 */
export function isThemeMetricToken(token: string): token is ThemeMetricToken {
  return byToken.get(token)?.kind === 'metric';
}
