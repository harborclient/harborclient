import { Select } from '@harborclient/sdk/components';
import { TERMINAL_FONT_WEIGHTS } from '@harborclient/core/generalSettings';
import type { TerminalFontWeight } from '@harborclient/core/types';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftTerminalField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Terminal font weight select backed by the shared settings draft.
 */
export function TerminalFontWeightField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.fontWeight">
      <Select
        id="setting-terminal-fontWeight"
        value={general.terminal.fontWeight}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftTerminalField({
              key: 'fontWeight',
              value: event.target.value as TerminalFontWeight
            })
          )
        }
      >
        {TERMINAL_FONT_WEIGHTS.map((weight) => (
          <option key={weight} value={weight}>
            {weight}
          </option>
        ))}
      </Select>
    </SettingField>
  );
}
