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
 * Script file-access root directory field backed by the shared settings draft.
 */
export function GeneralScriptFileRootField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  /**
   * Opens a directory dialog and stores the selected root path in the draft.
   */
  const handleBrowseScriptFileRoot = async (): Promise<void> => {
    const selected = await window.api.selectDirectory(general.scriptFileRoot);
    if (selected != null) {
      dispatch(setDraftGeneralField({ key: 'scriptFileRoot', value: selected }));
    }
  };

  return (
    <SettingField settingId="general.scriptFileRoot">
      <div className="flex gap-2">
        <Input
          type="text"
          className="min-w-0 flex-1"
          value={general.scriptFileRoot}
          disabled={disabled}
          placeholder="Leave empty to use your home directory"
          onChange={(event) =>
            dispatch(setDraftGeneralField({ key: 'scriptFileRoot', value: event.target.value }))
          }
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => void handleBrowseScriptFileRoot()}
        >
          Browse
        </Button>
      </div>
    </SettingField>
  );
}
