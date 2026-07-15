import type { JSX } from 'react';
import toast from 'react-hot-toast';
import type { Variable } from '#/shared/types';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setEnvironmentSettingsDirty } from '#/renderer/src/store/slices/navigationSlice';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { selectEnvironments } from '#/renderer/src/store/selectors';
import { updateEnvironment } from '#/renderer/src/store/thunks';
import { EnvironmentSettings } from '#/renderer/src/ui/Tabs/EnvironmentSettings';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Route wrapper for an environment settings page tab.
 *
 * @param props - Page identity and hosting tab id.
 * @returns Environment settings content, or null when the environment is missing.
 */
export function EnvironmentPageRoute({
  page,
  tabId
}: PageComponentProps<'environment'>): JSX.Element | null {
  const dispatch = useAppDispatch();
  const environments = useAppSelector(selectEnvironments);
  const environment = environments.find((entry) => entry.id === page.id);

  /**
   * Closes this settings tab when the user dismisses the page.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

  if (!environment) {
    return null;
  }

  return (
    <EnvironmentSettings
      environment={environment}
      focusVariableKey={page.focusVariableKey}
      onDirtyChange={(dirty) => dispatch(setEnvironmentSettingsDirty(dirty))}
      onSave={async (id: number, name: string, variables: Variable[]) => {
        try {
          await dispatch(updateEnvironment({ id, name, variables })).unwrap();
          toast.success('Environment updated');
        } catch (err) {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to update environment'));
        }
      }}
      onClose={handleClose}
    />
  );
}
