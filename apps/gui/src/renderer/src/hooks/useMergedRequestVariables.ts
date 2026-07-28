import { useMemo } from 'react';
import type { Variable } from '@harborclient/core/types';
import { resolveInheritedEnvironmentVariables } from '@harborclient/core/environmentTree';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectEnvironments
} from '#/renderer/src/store/selectors';

/**
 * Merges global, collection, folder, and environment variables; higher scopes win on duplicate keys.
 * Disabled rows are skipped so a lower scope can pass through.
 *
 * @param globalVars - Application-wide variables.
 * @param collectionVars - Collection-scoped variables.
 * @param folderVars - Folder-scoped variables.
 * @param envVars - Active environment variables (already inheritance-merged when applicable).
 * @returns Deduplicated variables for request editor highlighting.
 */
export function mergeRequestVariables(
  globalVars: Variable[],
  collectionVars: Variable[],
  folderVars: Variable[],
  envVars: Variable[]
): Variable[] {
  const map = new Map<string, Variable>();
  for (const variable of globalVars) {
    if (variable.enabled === false) continue;
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  for (const variable of collectionVars) {
    if (variable.enabled === false) continue;
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  for (const variable of folderVars) {
    if (variable.enabled === false) continue;
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  for (const variable of envVars) {
    if (variable.enabled === false) continue;
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  return Array.from(map.values());
}

/**
 * Returns merged global, collection, folder, and environment variables for one request draft.
 *
 * @param collectionId - Collection id from the request draft, if any.
 * @param folderId - Folder id from the request draft, if any.
 * @returns Variables for script and request editor substitution.
 */
export function useMergedRequestVariables(
  collectionId?: number,
  folderId?: number | null
): Variable[] {
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const foldersByCollection = useAppSelector((state) => state.collections.foldersByCollection);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);

  return useMemo(() => {
    const collection =
      collectionId != null ? collections.find((entry) => entry.id === collectionId) : undefined;
    const folder =
      collectionId != null && folderId != null
        ? (foldersByCollection[collectionId] ?? []).find((entry) => entry.id === folderId)
        : undefined;
    const environment =
      activeEnvironmentId != null
        ? environments.find((entry) => entry.id === activeEnvironmentId)
        : undefined;

    let envVars: Variable[] = [];
    if (environment) {
      try {
        envVars = resolveInheritedEnvironmentVariables(environment, environments);
      } catch {
        envVars = environment.variables.filter((variable) => variable.enabled !== false);
      }
    }

    return mergeRequestVariables(
      globalVariables,
      collection?.variables ?? [],
      folder?.variables ?? [],
      envVars
    );
  }, [
    activeEnvironmentId,
    collectionId,
    collections,
    environments,
    folderId,
    foldersByCollection,
    globalVariables
  ]);
}
