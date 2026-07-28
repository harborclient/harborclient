import type { Variable } from '@harborclient/core/types';

export type VariableScope = 'global' | 'collection' | 'folder' | 'environment';

export interface ResolvedVariable {
  key: string;
  value: string;
  scope: VariableScope;
  overridden: boolean;
  /**
   * When scope is environment and the key came from an ancestor, the ancestor display name.
   */
  sourceEnvName?: string;
}

/**
 * Resolves global, collection, folder, and environment variables with scope and override info.
 * Precedence: environment overrides folder overrides collection overrides global.
 * Disabled rows are skipped.
 *
 * @param globalVars - Application-wide variables.
 * @param collectionVars - Collection-scoped variables.
 * @param folderVars - Folder-scoped variables.
 * @param envVars - Effective environment variables (inheritance already merged).
 */
export function resolveScopedVariables(
  globalVars: Variable[] = [],
  collectionVars: Variable[] = [],
  folderVars: Variable[] = [],
  envVars: Variable[] = []
): ResolvedVariable[] {
  const enabled = (variables: Variable[]): Variable[] =>
    variables.filter((variable) => variable.enabled !== false && variable.key.trim() !== '');

  const activeGlobals = enabled(globalVars);
  const activeCollection = enabled(collectionVars);
  const activeFolder = enabled(folderVars);
  const activeEnv = enabled(envVars);

  const collectionKeys = new Set(activeCollection.map((v) => v.key.trim()));
  const folderKeys = new Set(activeFolder.map((v) => v.key.trim()));
  const envKeys = new Set(activeEnv.map((v) => v.key.trim()));
  const rows: ResolvedVariable[] = [];

  for (const variable of activeGlobals) {
    const key = variable.key.trim();
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'global',
      overridden: collectionKeys.has(key) || folderKeys.has(key) || envKeys.has(key)
    });
  }

  for (const variable of activeCollection) {
    const key = variable.key.trim();
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'collection',
      overridden: folderKeys.has(key) || envKeys.has(key)
    });
  }

  for (const variable of activeFolder) {
    const key = variable.key.trim();
    rows.push({
      key,
      value: variable.value !== '' ? variable.value : variable.defaultValue,
      scope: 'folder',
      overridden: envKeys.has(key)
    });
  }

  for (const variable of activeEnv) {
    const key = variable.key.trim();
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
 *
 * @param rows - Resolved variable rows.
 * @returns Number of non-overridden rows.
 */
export function effectiveCount(rows: ResolvedVariable[]): number {
  return rows.filter((row) => !row.overridden).length;
}
