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
 * Terminal scrollback rows field backed by the shared settings draft.
 */
export function TerminalScrollbackField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.scrollback">
      <Input
        id="setting-terminal-scrollback"
        type="number"
        min={0}
        value={general.terminal.scrollback}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) {
            return;
          }
          dispatch(setDraftTerminalField({ key: 'scrollback', value: parsed }));
        }}
      />
    </SettingField>
  );
}
