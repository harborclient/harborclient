import type { JSX } from 'react';
import toast from 'react-hot-toast';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { mirrorLegacyScriptString } from '#/shared/scriptRefs';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setFolderSettingsDirty } from '#/renderer/src/store/slices/navigationSlice';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { selectFoldersByCollection } from '#/renderer/src/store/selectors';
import { updateFolder } from '#/renderer/src/store/thunks';
import { FolderSettings } from '#/renderer/src/ui/Tabs/FolderSettings';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Route wrapper for a folder settings page tab.
 *
 * @param props - Page identity and hosting tab id.
 * @returns Folder settings content, or null when the folder is missing.
 */
export function FolderPageRoute({ page, tabId }: PageComponentProps<'folder'>): JSX.Element | null {
  const dispatch = useAppDispatch();
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const folder = (foldersByCollection[page.collectionId] ?? []).find(
    (entry) => entry.id === page.id
  );

  /**
   * Closes this settings tab when the user dismisses the page.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

  if (!folder) {
    return null;
  }

  return (
    <FolderSettings
      folder={folder}
      focusVariableKey={page.focusVariableKey}
      onDirtyChange={(dirty) => dispatch(setFolderSettingsDirty(dirty))}
      onSave={async (
        id: number,
        collectionId: number,
        name: string,
        variables: Variable[],
        headers: KeyValue[],
        preRequestScripts: ScriptRef[],
        postRequestScripts: ScriptRef[],
        auth: AuthConfig
      ) => {
        try {
          await dispatch(
            updateFolder({
              id,
              collectionId,
              name,
              variables,
              headers,
              preRequestScript: mirrorLegacyScriptString(preRequestScripts),
              postRequestScript: mirrorLegacyScriptString(postRequestScripts),
              preRequestScripts,
              postRequestScripts,
              auth
            })
          ).unwrap();
          toast.success('Folder updated');
        } catch (err) {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to update folder'));
          throw err;
        }
      }}
      onClose={handleClose}
    />
  );
}
