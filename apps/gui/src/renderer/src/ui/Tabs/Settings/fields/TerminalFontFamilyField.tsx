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
 * Terminal font family field backed by the shared settings draft.
 */
export function TerminalFontFamilyField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.fontFamily">
      <Input
        id="setting-terminal-fontFamily"
        type="text"
        value={general.terminal.fontFamily}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftTerminalField({ key: 'fontFamily', value: event.target.value }))
        }
      />
    </SettingField>
  );
}
