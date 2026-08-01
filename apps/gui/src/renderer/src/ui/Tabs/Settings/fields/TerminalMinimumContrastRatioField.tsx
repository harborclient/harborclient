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
 * Terminal minimum contrast ratio field backed by the shared settings draft.
 */
export function TerminalMinimumContrastRatioField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.minimumContrastRatio">
      <Input
        id="setting-terminal-minimumContrastRatio"
        type="number"
        min={1}
        max={21}
        step={0.1}
        value={general.terminal.minimumContrastRatio}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) {
            return;
          }
          dispatch(setDraftTerminalField({ key: 'minimumContrastRatio', value: parsed }));
        }}
      />
    </SettingField>
  );
}
