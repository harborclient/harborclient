import type { Variable } from '#/shared/types';

export type VariableEditScope = 'global' | 'collection' | 'folder' | 'environment';

export interface VariableEditTarget {
  scope: VariableEditScope;
  collectionId?: number;
  folderId?: number;
  environmentId?: number;
}

export interface ResolveVariableEditTargetInput {
  key: string;
  globalVariables: Variable[];
  collectionVariables: Variable[];
  folderVariables: Variable[];
  environmentVariables: Variable[];
  activeCollectionId: number | null;
  activeFolderId: number | null;
  activeEnvironmentId: number | null;
}

/**
 * Returns whether a variable list contains a row with the given key.
 *
 * @param variables - Variable rows to search.
 * @param key - Trimmed variable name.
 */
function hasVariableKey(variables: Variable[], key: string): boolean {
  return variables.some((variable) => variable.key.trim() === key);
}

/**
 * Resolves which settings screen should open when editing a hovered variable.
 *
 * Uses the same precedence as request substitution: environment overrides
 * folder overrides collection overrides global. When the key is not defined in any scope,
 * falls back to the active folder, collection, or environment when available.
 *
 * @param input - Variable key and active scope context.
 * @returns Navigation target, or null when the key is empty or no fallback exists.
 */
export function resolveVariableEditTarget(
  input: ResolveVariableEditTargetInput
): VariableEditTarget | null {
  const trimmedKey = input.key.trim();
  if (!trimmedKey) {
    return null;
  }

  if (hasVariableKey(input.environmentVariables, trimmedKey) && input.activeEnvironmentId != null) {
    return { scope: 'environment', environmentId: input.activeEnvironmentId };
  }

  if (hasVariableKey(input.folderVariables, trimmedKey) && input.activeFolderId != null) {
    return {
      scope: 'folder',
      collectionId: input.activeCollectionId ?? undefined,
      folderId: input.activeFolderId
    };
  }

  if (hasVariableKey(input.collectionVariables, trimmedKey) && input.activeCollectionId != null) {
    return { scope: 'collection', collectionId: input.activeCollectionId };
  }

  if (hasVariableKey(input.globalVariables, trimmedKey)) {
    return { scope: 'global' };
  }

  if (input.activeFolderId != null && input.activeCollectionId != null) {
    return {
      scope: 'folder',
      collectionId: input.activeCollectionId,
      folderId: input.activeFolderId
    };
  }

  if (input.activeCollectionId != null) {
    return { scope: 'collection', collectionId: input.activeCollectionId };
  }

  if (input.activeEnvironmentId != null) {
    return { scope: 'environment', environmentId: input.activeEnvironmentId };
  }

  return null;
}
