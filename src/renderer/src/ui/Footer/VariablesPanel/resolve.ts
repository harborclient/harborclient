import type { Variable } from '#/shared/types';

export type VariableScope = 'global' | 'collection' | 'folder' | 'environment';

export interface ResolvedVariable {
  key: string;
  value: string;
  scope: VariableScope;
  overridden: boolean;
}

/**
 * Resolves global, collection, folder, and environment variables with scope and override info.
 * Precedence: environment overrides folder overrides collection overrides global.
 */
export function resolveScopedVariables(
  globalVars: Variable[] = [],
  collectionVars: Variable[] = [],
  folderVars: Variable[] = [],
  envVars: Variable[] = []
): ResolvedVariable[] {
  const collectionKeys = new Set(collectionVars.map((v) => v.key.trim()).filter(Boolean));
  const folderKeys = new Set(folderVars.map((v) => v.key.trim()).filter(Boolean));
  const envKeys = new Set(envVars.map((v) => v.key.trim()).filter(Boolean));
  const rows: ResolvedVariable[] = [];

  for (const variable of globalVars) {
    const key = variable.key.trim();
    if (!key) continue;
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'global',
      overridden: collectionKeys.has(key) || folderKeys.has(key) || envKeys.has(key)
    });
  }

  for (const variable of collectionVars) {
    const key = variable.key.trim();
    if (!key) continue;
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'collection',
      overridden: folderKeys.has(key) || envKeys.has(key)
    });
  }

  for (const variable of folderVars) {
    const key = variable.key.trim();
    if (!key) continue;
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'folder',
      overridden: envKeys.has(key)
    });
  }

  for (const variable of envVars) {
    const key = variable.key.trim();
    if (!key) continue;
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'environment',
      overridden: false
    });
  }

  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Count of variables that are in effect (not overridden by a higher-precedence scope).
 */
export function effectiveCount(rows: ResolvedVariable[]): number {
  return rows.filter((row) => !row.overridden).length;
}
