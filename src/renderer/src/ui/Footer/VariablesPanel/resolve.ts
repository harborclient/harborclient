import type { Variable } from '#/shared/types';

export type VariableScope = 'collection' | 'environment';

export interface ResolvedVariable {
  key: string;
  value: string;
  scope: VariableScope;
  overridden: boolean;
}

/**
 * Resolves collection and environment variables with scope and override info.
 * Environment wins on duplicate keys.
 */
export function resolveScopedVariables(
  collectionVars: Variable[],
  envVars: Variable[]
): ResolvedVariable[] {
  const envKeys = new Set(envVars.map((v) => v.key.trim()).filter(Boolean));
  const rows: ResolvedVariable[] = [];

  for (const variable of collectionVars) {
    const key = variable.key.trim();
    if (!key) continue;
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'collection',
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
 * Count of variables that are in effect (not overridden by environment).
 */
export function effectiveCount(rows: ResolvedVariable[]): number {
  return rows.filter((row) => !row.overridden).length;
}
