import type { JSX } from 'react';
import toast from 'react-hot-toast';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { mirrorLegacyScriptString } from '#/shared/scriptRefs';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setCollectionSettingsDirty } from '#/renderer/src/store/slices/navigationSlice';
import { closeTab, openPageTab } from '#/renderer/src/store/slices/tabsSlice';
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
  const collection = collections.find((entry) => entry.id === page.id);

  /**
   * Closes this settings tab when the user dismisses the page.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

  if (!collection) {
    return null;
  }

  return (
    <CollectionSettings
      collection={collection}
      focusVariableKey={page.focusVariableKey}
      focusSection={page.focusSection}
      tabId={tabId}
      onDirtyChange={(dirty) => dispatch(setCollectionSettingsDirty(dirty))}
      onSave={async (
        id: number,
        name: string,
        variables: Variable[],
        headers: KeyValue[],
        preRequestScripts: ScriptRef[],
        postRequestScripts: ScriptRef[],
        auth: AuthConfig,
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
              connectionId
            })
          ).unwrap();
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
