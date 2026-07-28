import { Button, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Workflow results auto-export directory field backed by the shared settings draft.
 */
export function GeneralWorkflowResultsDirectoryField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  /**
   * Opens a directory dialog and stores the selected path in the draft.
   */
  const handleBrowse = async (): Promise<void> => {
    const selected = await window.api.selectDirectory(general.workflowResultsDirectory);
    if (selected != null) {
      dispatch(setDraftGeneralField({ key: 'workflowResultsDirectory', value: selected }));
    }
  };

  return (
    <SettingField settingId="general.workflowResultsDirectory">
      <div className="flex gap-2">
        <Input
          type="text"
          className="min-w-0 flex-1"
          value={general.workflowResultsDirectory}
          disabled={disabled}
          placeholder="Leave empty to disable auto-export"
          aria-label="Workflow results directory"
          onChange={(event) =>
            dispatch(
              setDraftGeneralField({
                key: 'workflowResultsDirectory',
                value: event.target.value
              })
            )
          }
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          aria-label="Browse for workflow results directory"
          onClick={() => void handleBrowse()}
        >
          Browse
        </Button>
      </div>
    </SettingField>
  );
}
