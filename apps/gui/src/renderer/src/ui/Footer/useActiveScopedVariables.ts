import { useMemo } from 'react';
import type { Variable } from '@harborclient/core/types';
import { resolveInheritedEnvironmentVariables } from '@harborclient/core/environmentTree';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';

/**
 * Scoped variable arrays and display names used by the footer variables badge
 * and variables panel.
 */
export interface ActiveScopedVariables {
  /**
   * Variables from app-wide global settings.
   */
  globalVariables: Variable[];

  /**
   * Variables from the active collection.
   */
  collectionVariables: Variable[];

  /**
   * Variables from the active folder.
   */
  folderVariables: Variable[];

  /**
   * Variables from the active environment, including inherited ancestors.
   */
  environmentVariables: Variable[];

  /**
   * Name of the active collection, if any.
   */
  collectionName?: string;

  /**
   * Name of the active folder, if any.
   */
  folderName?: string;

  /**
   * Name of the active environment, if any.
   */
  environmentName?: string;
}

/**
 * Reads global, collection, folder, and environment variables for the active
 * request draft so the footer variables badge can show an effective count and
 * the variables panel can label each scope.
 *
 * Resolves the active collection from the draft (falling back to the selected
 * collection), the folder from a saved request or draft folder id, and
 * environment variables via parentUuid inheritance.
 *
 * @returns Scoped variable arrays plus collection, folder, and environment names.
 */
export function useActiveScopedVariables(): ActiveScopedVariables {
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const draft = useAppSelector(selectDraft);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);

  const activeCollectionId = draft.collection_id ?? selectedCollectionId;

  /**
   * Resolves the folder that owns the active draft request, preferring the
   * persisted folder id on a saved request over the draft's in-memory folder.
   */
  const activeFolderId = useMemo(() => {
    if (activeCollectionId == null) return null;
    if (draft.id != null) {
      const saved = (requestsByCollection[activeCollectionId] ?? []).find(
        (request) => request.id === draft.id
      );
      if (saved) return saved.folder_id;
    }
    return draft.folder_id ?? null;
  }, [activeCollectionId, draft.folder_id, draft.id, requestsByCollection]);

  /**
   * Looks up the active collection row for its variable list and name.
   */
  const activeCollection = useMemo(() => {
    if (activeCollectionId == null) return undefined;
    return collections.find((collection) => collection.id === activeCollectionId);
  }, [activeCollectionId, collections]);

  /**
   * Looks up the active folder row for its variable list and name.
   */
  const activeFolder = useMemo(() => {
    if (activeCollectionId == null || activeFolderId == null) return undefined;
    return (foldersByCollection[activeCollectionId] ?? []).find(
      (folder) => folder.id === activeFolderId
    );
  }, [activeCollectionId, activeFolderId, foldersByCollection]);

  /**
   * Looks up the active environment row for its name and inherited variables.
   */
  const activeEnvironment = useMemo(() => {
    if (activeEnvironmentId == null) return undefined;
    return environments.find((env) => env.id === activeEnvironmentId);
  }, [activeEnvironmentId, environments]);

  /**
   * Effective environment variables including ancestors from parentUuid inheritance.
   */
  const environmentVariables = useMemo(() => {
    if (!activeEnvironment) {
      return [];
    }
    try {
      return resolveInheritedEnvironmentVariables(activeEnvironment, environments);
    } catch {
      return activeEnvironment.variables.filter((variable) => variable.enabled !== false);
    }
  }, [activeEnvironment, environments]);

  return {
    globalVariables,
    collectionVariables: activeCollection?.variables ?? [],
    folderVariables: activeFolder?.variables ?? [],
    environmentVariables,
    collectionName: activeCollection?.name,
    folderName: activeFolder?.name,
    environmentName: activeEnvironment?.name
  };
}
