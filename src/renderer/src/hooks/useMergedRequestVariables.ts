import { useMemo } from 'react';
import type { Variable } from '#/shared/types';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectEnvironments
} from '#/renderer/src/store/selectors';

/**
 * Merges global, collection, and environment variables; higher scopes win on duplicate keys.
 *
 * @param globalVars - Application-wide variables.
 * @param collectionVars - Collection-scoped variables.
 * @param envVars - Active environment variables.
 * @returns Deduplicated variables for request editor highlighting.
 */
export function mergeRequestVariables(
  globalVars: Variable[],
  collectionVars: Variable[],
  envVars: Variable[]
): Variable[] {
  const map = new Map<string, Variable>();
  for (const variable of globalVars) {
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  for (const variable of collectionVars) {
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  for (const variable of envVars) {
    const key = variable.key.trim();
    if (key) map.set(key, variable);
  }
  return Array.from(map.values());
}

/**
 * Returns merged global, collection, and environment variables for one request draft.
 *
 * @param collectionId - Collection id from the request draft, if any.
 * @returns Variables for script and request editor substitution.
 */
export function useMergedRequestVariables(collectionId?: number): Variable[] {
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);

  return useMemo(() => {
    const collection =
      collectionId != null ? collections.find((entry) => entry.id === collectionId) : undefined;
    const environment =
      activeEnvironmentId != null
        ? environments.find((entry) => entry.id === activeEnvironmentId)
        : undefined;

    return mergeRequestVariables(
      globalVariables,
      collection?.variables ?? [],
      environment?.variables ?? []
    );
  }, [activeEnvironmentId, collectionId, collections, environments, globalVariables]);
}
