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
 * Log file path field backed by the shared settings draft.
 */
export function GeneralLogFilePathField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  /**
   * Opens a save dialog and stores the selected log file path in the draft.
   */
  const handleBrowseLogFilePath = async (): Promise<void> => {
    const selected = await window.api.selectSaveFile(general.logFilePath);
    if (selected != null) {
      dispatch(setDraftGeneralField({ key: 'logFilePath', value: selected }));
    }
  };

  return (
    <SettingField settingId="general.logFilePath">
      <div className="flex gap-2">
        <Input
          type="text"
          className="min-w-0 flex-1"
          value={general.logFilePath}
          disabled={disabled}
          placeholder="Leave empty to disable file logging"
          onChange={(event) =>
            dispatch(setDraftGeneralField({ key: 'logFilePath', value: event.target.value }))
          }
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => void handleBrowseLogFilePath()}
        >
          Browse
        </Button>
      </div>
    </SettingField>
  );
}
