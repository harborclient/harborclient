import { Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftTerminalField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Terminal fast-scroll sensitivity field backed by the shared settings draft.
 */
export function TerminalFastScrollSensitivityField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.fastScrollSensitivity">
      <Input
        id="setting-terminal-fastScrollSensitivity"
        type="number"
        min={0}
        value={general.terminal.fastScrollSensitivity}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) {
            return;
          }
          dispatch(setDraftTerminalField({ key: 'fastScrollSensitivity', value: parsed }));
        }}
      />
    </SettingField>
  );
}
