import { useCallback, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '@harborclient/core/types';
import { mirrorLegacyScriptString } from '@harborclient/core/scriptRefs';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setFolderSettingsDirty } from '#/renderer/src/store/slices/navigationSlice';
import {
  clearPageScopedSettingsDraft,
  setPageFocusSection,
  setPageScopedSettingsDraft,
  setPageTabDirty
} from '#/renderer/src/store/slices/tabsSlice';
import { isPageTab, type ScopedSettingsDraft } from '#/renderer/src/store/tabs';
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
  const pageTab = useAppSelector((state) => state.tabs.tabs.find((tab) => tab.tabId === tabId));
  const folder = (foldersByCollection[page.collectionId] ?? []).find(
    (entry) => entry.id === page.id
  );

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
   * Tracks unsaved edits on the page tab and the legacy navigation dirty flag.
   *
   * @param dirty - Whether the form currently differs from the last save.
   */
  const handleDirtyChange = useCallback(
    (dirty: boolean): void => {
      dispatch(setPageTabDirty({ tabId, dirty }));
      dispatch(setFolderSettingsDirty(dirty));
    },
    [dispatch, tabId]
  );

  if (!folder) {
    return null;
  }

  const seed = pageTab && isPageTab(pageTab) ? pageTab.scopedSettingsDraft : undefined;

  return (
    <FolderSettings
      folder={folder}
      focusVariableKey={page.focusVariableKey}
      focusSection={page.focusSection}
      tabId={tabId}
      seed={seed}
      onDirtyChange={handleDirtyChange}
      onDraftChange={handleDraftChange}
      onSectionChange={(section) => dispatch(setPageFocusSection({ tabId, focusSection: section }))}
      onSave={async (
        id: number,
        collectionId: number,
        name: string,
        variables: Variable[],
        headers: KeyValue[],
        preRequestScripts: ScriptRef[],
        postRequestScripts: ScriptRef[],
        auth: AuthConfig,
        userAgent: string
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
              auth,
              userAgent
            })
          ).unwrap();
          dispatch(clearPageScopedSettingsDraft(tabId));
          toast.success('Folder updated');
        } catch (err) {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to update folder'));
          throw err;
        }
      }}
    />
  );
}
