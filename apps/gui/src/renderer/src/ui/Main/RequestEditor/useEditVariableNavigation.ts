import { useCallback } from 'react';
import { resolveInheritedEnvironmentVariables } from '@harborclient/core/environmentTree';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectEnvironments,
  selectFoldersByCollection
} from '#/renderer/src/store/selectors';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { resolveVariableEditTarget } from './resolveVariableEditTarget';

/**
 * Returns a handler that opens the settings page tab where a variable is defined.
 *
 * Resolves scope using the same precedence as request substitution (environment,
 * folder, collection, global), then dispatches `openPageTab` with `focusVariableKey`.
 *
 * @param collectionId - Active collection id for the current editor context, if any.
 * @param folderId - Active folder id for the current editor context, if any.
 * @returns Callback that navigates to the owning scope for the given variable key.
 */
export function useEditVariableNavigation(
  collectionId: number | null,
  folderId: number | null
): (key: string) => void {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);

  /**
   * Opens the page tab where the hovered variable is defined.
   *
   * @param key - Variable name from the editor token.
   */
  return useCallback(
    (key: string): void => {
      const activeCollection =
        collectionId != null ? collections.find((entry) => entry.id === collectionId) : undefined;
      const activeEnvironment =
        activeEnvironmentId != null
          ? environments.find((entry) => entry.id === activeEnvironmentId)
          : undefined;
      let environmentVariables =
        activeEnvironment?.variables.filter((variable) => variable.enabled !== false) ?? [];
      if (activeEnvironment) {
        try {
          environmentVariables = resolveInheritedEnvironmentVariables(
            activeEnvironment,
            environments
          );
        } catch {
          // Keep own enabled variables when the inheritance chain is invalid.
        }
      }

      const activeFolder =
        collectionId != null && folderId != null
          ? (foldersByCollection[collectionId] ?? []).find((entry) => entry.id === folderId)
          : undefined;

      const target = resolveVariableEditTarget({
        key,
        globalVariables,
        collectionVariables: activeCollection?.variables ?? [],
        folderVariables: activeFolder?.variables ?? [],
        environmentVariables,
        activeCollectionId: collectionId,
        activeFolderId: folderId,
        activeEnvironmentId
      });
      if (target == null) {
        return;
      }

      if (target.scope === 'environment' && target.environmentId != null) {
        dispatch(
          openPageTab({
            type: 'environment',
            id: target.environmentId,
            focusVariableKey: key
          })
        );
        return;
      }

      if (target.scope === 'folder' && target.folderId != null) {
        dispatch(
          openPageTab({
            type: 'folder',
            collectionId: target.collectionId ?? collectionId ?? 0,
            id: target.folderId,
            focusVariableKey: key
          })
        );
        return;
      }

      if (target.scope === 'collection' && target.collectionId != null) {
        dispatch(
          openPageTab({
            type: 'collection',
            id: target.collectionId,
            focusVariableKey: key
          })
        );
        return;
      }

      dispatch(
        openPageTab({
          type: 'settings',
          section: 'globals',
          focusVariableKey: key
        })
      );
    },
    [
      activeEnvironmentId,
      collectionId,
      collections,
      dispatch,
      environments,
      folderId,
      foldersByCollection,
      globalVariables
    ]
  );
}
