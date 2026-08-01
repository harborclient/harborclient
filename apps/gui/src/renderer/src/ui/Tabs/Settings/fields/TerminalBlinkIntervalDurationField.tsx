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
 * Terminal blink-attribute interval field backed by the shared settings draft.
 */
export function TerminalBlinkIntervalDurationField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.blinkIntervalDuration">
      <Input
        id="setting-terminal-blinkIntervalDuration"
        type="number"
        min={0}
        value={general.terminal.blinkIntervalDuration}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) {
            return;
          }
          dispatch(setDraftTerminalField({ key: 'blinkIntervalDuration', value: parsed }));
        }}
      />
    </SettingField>
  );
}
