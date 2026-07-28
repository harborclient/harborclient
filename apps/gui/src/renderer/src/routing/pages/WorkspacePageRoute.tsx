import type { JSX } from 'react';
import toast from 'react-hot-toast';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setWorkspaceSettingsDirty } from '#/renderer/src/store/slices/navigationSlice';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import { selectEnvironments } from '#/renderer/src/store/selectors';
import { updateWorkspaceSettings } from '#/renderer/src/store/thunks/workspaces';
import { WorkspaceSettings } from '#/renderer/src/ui/Tabs/WorkspaceSettings';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Route wrapper for a workspace settings page tab.
 *
 * @param props - Page identity and hosting tab id.
 * @returns Workspace settings content, or null when the workspace is missing.
 */
export function WorkspacePageRoute({
  page,
  tabId
}: PageComponentProps<'workspace'>): JSX.Element | null {
  const dispatch = useAppDispatch();
  const workspaces = useAppSelector(selectWorkspaces);
  const environments = useAppSelector(selectEnvironments);
  const workspace = workspaces.find((entry) => entry.id === page.id);

  /**
   * Closes this settings tab when the user dismisses the page.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

  if (!workspace) {
    return null;
  }

  return (
    <WorkspaceSettings
      workspace={workspace}
      environments={environments}
      tabId={tabId}
      onDirtyChange={(dirty) => dispatch(setWorkspaceSettingsDirty(dirty))}
      onSave={async (id: number, name: string, activeEnvironmentUuid: string | null) => {
        try {
          await dispatch(updateWorkspaceSettings({ id, name, activeEnvironmentUuid })).unwrap();
          toast.success('Workspace updated');
        } catch (err) {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to update workspace'));
        }
      }}
      onClose={handleClose}
    />
  );
}
