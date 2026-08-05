/**
 * Generates `src/theme/hc_theme.json` from HarborClient theme token types and
 * built-in default palettes (same sources as the docs site theme manifest).
 *
 * Token ids come from `ThemeColorToken` / `ThemeMetricToken` in the SDK.
 * Labels/groups come from `@harborclient/core` custom theme metadata.
 * Default light/dark/high-contrast values come from the GUI Designer defaults.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(coreRoot, '../..');

const typesPath = path.join(monorepoRoot, 'packages/sdk/src/types.ts');
const customThemePath = path.join(coreRoot, 'src/types/customTheme.ts');
const highContrastPath = path.join(coreRoot, 'src/highContrastPalette.ts');
const defaultsPath = path.join(
  monorepoRoot,
  'apps/gui/src/renderer/src/ui/Tabs/Plugins/customThemeDefaults.ts'
);
const themeManifestPath = path.join(coreRoot, 'src/theme/hc_theme.json');

/**
 * Extracts string-literal members from a TypeScript string-union type.
 *
 * @param {string} source TypeScript source.
 * @param {string} typeName Exported type name.
 * @returns {string[]} Ordered union members.
 */
const extractStringUnionMembers = (source, typeName) => {
  const pattern = new RegExp(
    `export type ${typeName}\\s*=([\\s\\S]*?);\\s*(?:\\n\\s*(?:/\\*|export|import)|$)`
  );
  const match = pattern.exec(source);

  if (!match) {
    throw new Error(`Could not find export type ${typeName}`);
  }

  const members = [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);

  if (members.length === 0) {
    throw new Error(`No string members found for ${typeName}`);
  }

  return members;
};

/**
 * Parses per-token descriptions from a Theme*Token JSDoc block.
 *
 * @param {string} source TypeScript source containing the type.
 * @param {string} typeName Exported type name whose preceding JSDoc is parsed.
 * @returns {Map<string, string>} Token id → description.
 */
const extractTokenDescriptions = (source, typeName) => {
  const typeIndex = source.indexOf(`export type ${typeName}`);

  if (typeIndex < 0) {
    throw new Error(`Could not find export type ${typeName}`);
  }

  const before = source.slice(0, typeIndex);
  const docStart = before.lastIndexOf('/**');

  if (docStart < 0) {
    return new Map();
  }

  const doc = before.slice(docStart);
  /** @type {Map<string, string>} */
  const descriptions = new Map();
  const bulletPattern = /^\s*\*\s*-\s*((?:`[^`]+`(?:\s*,\s*)?)+)\s*—\s*(.+)$/gm;

  for (const match of doc.matchAll(bulletPattern)) {
    const tokens = [...match[1].matchAll(/`([^`]+)`/g)].map((item) => item[1]);
    const description = match[2].trim().replace(/\s+/g, ' ');

    for (const token of tokens) {
      descriptions.set(token, description);
    }
  }

  return descriptions;
};

/**
 * Parses a `Record<…, string>` object literal for quoted keys.
 *
 * @param {string} source TypeScript source.
 * @param {string} constName Exported const name.
 * @returns {Record<string, string>} Key → raw value expression text.
 */
const extractQuotedRecord = (source, constName) => {
  const startPattern = new RegExp(`export const ${constName}[^=]*=\\s*\\{`);
  const startMatch = startPattern.exec(source);

  if (!startMatch) {
    throw new Error(`Could not find export const ${constName}`);
  }

  let index = startMatch.index + startMatch[0].length;
  let depth = 1;
  let body = '';

  while (index < source.length && depth > 0) {
    const char = source[index];

    if (char === '{') {
      depth += 1;
      body += char;
    } else if (char === '}') {
      depth -= 1;
      if (depth > 0) {
        body += char;
      }
    } else {
      body += char;
    }

    index += 1;
  }

  /** @type {Record<string, string>} */
  const record = {};
  const entryPattern =
    /(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*('(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[A-Za-z0-9_.]+)/g;

  for (const match of body.matchAll(entryPattern)) {
    const key = match[1] || match[2] || match[3];
    record[key] = match[4];
  }

  return record;
};

/**
 * Parses exported string constants (`export const NAME = '…'` or alias).
 *
 * @param {string} source TypeScript source.
 * @returns {Map<string, string>} Constant name → resolved string value.
 */
const extractStringConstants = (source) => {
  /** @type {Map<string, string>} */
  const values = new Map();
  const pattern =
    /export const ([A-Z0-9_]+)\s*=\s*('(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[A-Z0-9_]+)\s*;/g;

  for (const match of source.matchAll(pattern)) {
    values.set(match[1], match[2]);
  }

  /**
   * Resolves a constant or literal to a concrete string.
   *
   * @param {string} expression Raw right-hand side.
   * @param {number} [depth] Recursion guard.
   * @returns {string}
   */
  const resolve = (expression, depth = 0) => {
    if (depth > 20) {
      throw new Error(`Constant resolution exceeded depth for ${expression}`);
    }

    const trimmed = expression.trim();

    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    }

    const aliased = values.get(trimmed);

    if (!aliased) {
      throw new Error(`Unknown constant reference: ${trimmed}`);
    }

    return resolve(aliased, depth + 1);
  };

  /** @type {Map<string, string>} */
  const resolved = new Map();

  for (const name of values.keys()) {
    resolved.set(name, resolve(name));
  }

  return resolved;
};

/**
 * Resolves a raw object-literal value expression to a CSS string.
 *
 * @param {string} expression Raw value from a palette/metrics object.
 * @param {Map<string, string>} constants Resolved constant map.
 * @returns {string}
 */
const resolveValueExpression = (expression, constants) => {
  const trimmed = expression.trim();

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  const fromConstants = constants.get(trimmed);

  if (fromConstants !== undefined) {
    return fromConstants;
  }

  throw new Error(`Unable to resolve value expression: ${trimmed}`);
};

/**
 * Parses Designer labels and groups from customTheme.ts.
 *
 * @param {string} source customTheme.ts contents.
 * @returns {{
 *   colorLabels: Record<string, string>;
 *   metricLabels: Record<string, string>;
 *   colorGroups: Map<string, string>;
 *   metricGroups: Map<string, string>;
 *   colorOrder: string[];
 *   metricOrder: string[];
 * }}
 */
const parseCustomThemeMetadata = (source) => {
  const colorLabelsRaw = extractQuotedRecord(source, 'CUSTOM_THEME_TOKEN_LABELS');
  const metricLabelsRaw = extractQuotedRecord(source, 'CUSTOM_THEME_METRIC_LABELS');

  /** @type {Record<string, string>} */
  const colorLabels = {};
  /** @type {Record<string, string>} */
  const metricLabels = {};

  for (const [key, value] of Object.entries(colorLabelsRaw)) {
    colorLabels[key] = resolveValueExpression(value, new Map());
  }

  for (const [key, value] of Object.entries(metricLabelsRaw)) {
    metricLabels[key] = resolveValueExpression(value, new Map());
  }

  /** @type {Map<string, string>} */
  const colorGroups = new Map();
  /** @type {Map<string, string>} */
  const metricGroups = new Map();
  /** @type {string[]} */
  const colorOrder = [];
  /** @type {string[]} */
  const metricOrder = [];

  /**
   * Parses one groups array (`CUSTOM_THEME_TOKEN_GROUPS` / `CUSTOM_THEME_METRIC_GROUPS`).
   *
   * @param {string} constName Exported const name.
   * @param {Map<string, string>} groupMap Output token → group label.
   * @param {string[]} order Output ordered tokens.
   */
  const parseGroups = (constName, groupMap, order) => {
    const startPattern = new RegExp(`export const ${constName}[^=]*=\\s*\\[`);
    const startMatch = startPattern.exec(source);

    if (!startMatch) {
      throw new Error(`Could not find export const ${constName}`);
    }

    let index = startMatch.index + startMatch[0].length;
    let depth = 1;
    let body = '';

    while (index < source.length && depth > 0) {
      const char = source[index];

      if (char === '[') {
        depth += 1;
        body += char;
      } else if (char === ']') {
        depth -= 1;
        if (depth > 0) {
          body += char;
        }
      } else {
        body += char;
      }

      index += 1;
    }

    const groupPattern = /\{\s*label:\s*'([^']+)'\s*,\s*tokens:\s*\[([\s\S]*?)\]\s*\}/g;

    for (const match of body.matchAll(groupPattern)) {
      const groupLabel = match[1];
      const tokens = [...match[2].matchAll(/'([^']+)'/g)].map((item) => item[1]);

      for (const token of tokens) {
        groupMap.set(token, groupLabel);
        order.push(token);
      }
    }
  };

  parseGroups('CUSTOM_THEME_TOKEN_GROUPS', colorGroups, colorOrder);
  parseGroups('CUSTOM_THEME_METRIC_GROUPS', metricGroups, metricOrder);

  return {
    colorLabels,
    metricLabels,
    colorGroups,
    metricGroups,
    colorOrder,
    metricOrder
  };
};

/**
 * Builds a description for a color token.
 *
 * @param {string | undefined} jsdocDescription Description from SDK JSDoc.
 * @param {string} label Designer label.
 * @returns {string}
 */
const colorDescription = (jsdocDescription, label) => {
  if (jsdocDescription) {
    const sentence = jsdocDescription.charAt(0).toUpperCase() + jsdocDescription.slice(1);
    return `${sentence}.`;
  }

  return `${label} color token.`;
};

/**
 * Builds a description for a metric token.
 *
 * @param {string} group Group label.
 * @param {string} label Designer label.
 * @returns {string}
 */
const metricDescription = (group, label) => `${group} ${label.toLowerCase()} metric.`;

/**
 * Builds the theme manifest object keyed by CSS variable name.
 *
 * @param {{
 *   colorTokens: string[];
 *   metricTokens: string[];
 *   colorDescriptions: Map<string, string>;
 *   metadata: ReturnType<typeof parseCustomThemeMetadata>;
 *   lightColors: Record<string, string>;
 *   darkColors: Record<string, string>;
 *   highContrastColors: Record<string, string>;
 *   metrics: Record<string, string>;
 * }} input Parsed sources.
 * @returns {Record<string, {
 *   name: string;
 *   token: string;
 *   kind: 'color' | 'metric';
 *   group: string;
 *   label: string;
 *   description: string;
 *   defaults: { light: string; dark: string; highContrast: string };
 * }>}
 */
const buildThemeManifest = (input) => {
  /** @type {Record<string, any>} */
  const manifest = {};
  const errors = [];

  const colorTokenSet = new Set(input.colorTokens);
  const metricTokenSet = new Set(input.metricTokens);

  for (const token of input.metadata.colorOrder) {
    if (!colorTokenSet.has(token)) {
      errors.push(`customTheme color group lists unknown SDK token: ${token}`);
    }
  }

  for (const token of input.metadata.metricOrder) {
    if (!metricTokenSet.has(token)) {
      errors.push(`customTheme metric group lists unknown SDK token: ${token}`);
    }
  }

  for (const token of input.colorTokens) {
    const label = input.metadata.colorLabels[token];
    const group = input.metadata.colorGroups.get(token);
    const light = input.lightColors[token];
    const dark = input.darkColors[token];
    const highContrast = input.highContrastColors[token];

    if (!label) {
      errors.push(`Missing CUSTOM_THEME_TOKEN_LABELS entry for ${token}`);
    }

    if (!group) {
      errors.push(`Missing CUSTOM_THEME_TOKEN_GROUPS entry for ${token}`);
    }

    if (!light || !dark || !highContrast) {
      errors.push(`Missing default palette value(s) for color token ${token}`);
    }

    const name = `--mac-${token}`;
    manifest[name] = {
      name,
      token,
      kind: 'color',
      group: group ?? 'Ungrouped',
      label: label ?? token,
      description: colorDescription(input.colorDescriptions.get(token), label ?? token),
      defaults: {
        light: light ?? '',
        dark: dark ?? '',
        highContrast: highContrast ?? ''
      }
    };
  }

  for (const token of input.metricTokens) {
    const label = input.metadata.metricLabels[token];
    const group = input.metadata.metricGroups.get(token);
    const value = input.metrics[token];

    if (!label) {
      errors.push(`Missing CUSTOM_THEME_METRIC_LABELS entry for ${token}`);
    }

    if (!group) {
      errors.push(`Missing CUSTOM_THEME_METRIC_GROUPS entry for ${token}`);
    }

    if (!value) {
      errors.push(`Missing default metric value for ${token}`);
    }

    const name = `--mac-${token}`;
    manifest[name] = {
      name,
      token,
      kind: 'metric',
      group: group ?? 'Ungrouped',
      label: label ?? token,
      description: metricDescription(group ?? 'Theme', label ?? token),
      defaults: {
        light: value ?? '',
        dark: value ?? '',
        highContrast: value ?? ''
      }
    };
  }

  /** @type {Record<string, any>} */
  const ordered = {};

  for (const token of input.metadata.colorOrder) {
    const name = `--mac-${token}`;
    if (manifest[name]) {
      ordered[name] = manifest[name];
    }
  }

  for (const token of input.colorTokens) {
    const name = `--mac-${token}`;
    if (!ordered[name] && manifest[name]) {
      ordered[name] = manifest[name];
    }
  }

  for (const token of input.metadata.metricOrder) {
    const name = `--mac-${token}`;
    if (manifest[name]) {
      ordered[name] = manifest[name];
    }
  }

  for (const token of input.metricTokens) {
    const name = `--mac-${token}`;
    if (!ordered[name] && manifest[name]) {
      ordered[name] = manifest[name];
    }
  }

  if (errors.length > 0) {
    throw new Error(`Theme catalog generation failed:\n- ${errors.join('\n- ')}`);
  }

  return ordered;
};

/**
 * Resolves a palette object using literal strings and constant aliases.
 *
 * @param {Record<string, string>} raw Raw quoted-record parse.
 * @param {Map<string, string>} constants Resolved constants.
 * @returns {Record<string, string>}
 */
const resolvePalette = (raw, constants) => {
  /** @type {Record<string, string>} */
  const resolved = {};

  for (const [key, expression] of Object.entries(raw)) {
    resolved[key] = resolveValueExpression(expression, constants);
  }

  return resolved;
};

const [typesSource, customThemeSource, highContrastSource, defaultsSource] = await Promise.all([
  readFile(typesPath, 'utf8'),
  readFile(customThemePath, 'utf8'),
  readFile(highContrastPath, 'utf8'),
  readFile(defaultsPath, 'utf8')
]);

const colorTokens = extractStringUnionMembers(typesSource, 'ThemeColorToken');
const metricTokens = extractStringUnionMembers(typesSource, 'ThemeMetricToken');
const colorDescriptions = extractTokenDescriptions(typesSource, 'ThemeColorToken');
const metadata = parseCustomThemeMetadata(customThemeSource);

const highContrastConstants = extractStringConstants(highContrastSource);
const defaultsConstants = extractStringConstants(defaultsSource);
const allConstants = new Map([...highContrastConstants, ...defaultsConstants]);

const lightColors = resolvePalette(
  extractQuotedRecord(defaultsSource, 'LIGHT_CUSTOM_THEME_PALETTE'),
  allConstants
);
const darkColors = resolvePalette(
  extractQuotedRecord(defaultsSource, 'DARK_CUSTOM_THEME_PALETTE'),
  allConstants
);
const highContrastColors = resolvePalette(
  extractQuotedRecord(defaultsSource, 'HIGH_CONTRAST_CUSTOM_THEME_PALETTE'),
  allConstants
);
const metrics = resolvePalette(
  extractQuotedRecord(defaultsSource, 'DEFAULT_CUSTOM_THEME_METRICS'),
  allConstants
);

const manifest = buildThemeManifest({
  colorTokens,
  metricTokens,
  colorDescriptions,
  metadata,
  lightColors,
  darkColors,
  highContrastColors,
  metrics
});

await mkdir(path.dirname(themeManifestPath), { recursive: true });
await writeFile(themeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(
  `Generated theme catalog (${colorTokens.length} colors, ${metricTokens.length} metrics)`
);
console.log(`  ${path.relative(coreRoot, themeManifestPath)}`);
