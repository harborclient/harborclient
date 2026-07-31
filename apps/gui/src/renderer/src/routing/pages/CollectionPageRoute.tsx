import { useCallback, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '@harborclient/core/types';
import { mirrorLegacyScriptString } from '@harborclient/core/scriptRefs';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setCollectionSettingsDirty } from '#/renderer/src/store/slices/navigationSlice';
import {
  clearPageScopedSettingsDraft,
  closeTab,
  openPageTab,
  setPageConnectionIdDraft,
  setPageFocusSection,
  setPageScopedSettingsDraft,
  setPageTabDirty
} from '#/renderer/src/store/slices/tabsSlice';
import { isPageTab, type ScopedSettingsDraft } from '#/renderer/src/store/tabs';
import { selectCollections } from '#/renderer/src/store/selectors';
import { updateCollection } from '#/renderer/src/store/thunks';
import { CollectionSettings } from '#/renderer/src/ui/Tabs/CollectionSettings';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Route wrapper for a collection settings page tab.
 *
 * @param props - Page identity and hosting tab id.
 * @returns Collection settings content, or null when the collection is missing.
 */
export function CollectionPageRoute({
  page,
  tabId
}: PageComponentProps<'collection'>): JSX.Element | null {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const pageTab = useAppSelector((state) => state.tabs.tabs.find((tab) => tab.tabId === tabId));
  const collection = collections.find((entry) => entry.id === page.id);

  /**
   * Closes this settings tab when the user dismisses the page.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

  /**
   * Remembers core field drafts on the open tab across TabBar remounts.
   *
   * @param fields - Current scoped settings draft fields.
   */
  const handleDraftChange = useCallback(
    (fields: ScopedSettingsDraft): void => {
      dispatch(setPageScopedSettingsDraft({ tabId, draft: fields }));
    },
    [dispatch, tabId]
  );

  /**
   * Remembers the provider connection draft on the open tab.
   *
   * @param connectionId - Draft connection id.
   */
  const handleConnectionIdChange = useCallback(
    (connectionId: string): void => {
      dispatch(setPageConnectionIdDraft({ tabId, connectionId }));
    },
    [dispatch, tabId]
  );

  /**
   * Tracks unsaved edits on the page tab and the legacy navigation dirty flag.
   *
   * @param dirty - Whether the form currently differs from the last save.
   */
  const handleDirtyChange = useCallback(
    (dirty: boolean): void => {
      dispatch(setPageTabDirty({ tabId, dirty }));
      dispatch(setCollectionSettingsDirty(dirty));
    },
    [dispatch, tabId]
  );

  if (!collection) {
    return null;
  }

  const seed = pageTab && isPageTab(pageTab) ? pageTab.scopedSettingsDraft : undefined;
  const connectionIdSeed = pageTab && isPageTab(pageTab) ? pageTab.connectionIdDraft : undefined;

  return (
    <CollectionSettings
      collection={collection}
      focusVariableKey={page.focusVariableKey}
      focusSection={page.focusSection}
      tabId={tabId}
      seed={seed}
      connectionIdSeed={connectionIdSeed}
      onDirtyChange={handleDirtyChange}
      onDraftChange={handleDraftChange}
      onConnectionIdChange={handleConnectionIdChange}
      onSectionChange={(section) => dispatch(setPageFocusSection({ tabId, focusSection: section }))}
      onSave={async (
        id: number,
        name: string,
        variables: Variable[],
        headers: KeyValue[],
        preRequestScripts: ScriptRef[],
        postRequestScripts: ScriptRef[],
        auth: AuthConfig,
        userAgent: string,
        connectionId: string
      ) => {
        try {
          const result = await dispatch(
            updateCollection({
              id,
              name,
              variables,
              headers,
              preRequestScript: mirrorLegacyScriptString(preRequestScripts),
              postRequestScript: mirrorLegacyScriptString(postRequestScripts),
              preRequestScripts,
              postRequestScripts,
              auth,
              userAgent,
              connectionId
            })
          ).unwrap();
          dispatch(clearPageScopedSettingsDraft(tabId));
          if (result.id !== id) {
            dispatch(closeTab(tabId));
            dispatch(openPageTab({ type: 'collection', id: result.id }));
          }
          toast.success('Collection updated');
        } catch (err) {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to update collection'));
        }
      }}
      onClose={handleClose}
    />
  );
}
