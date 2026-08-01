import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftTerminalField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Terminal screen reader mode toggle backed by the shared settings draft.
 */
export function TerminalScreenReaderModeField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.screenReaderMode" layout="checkbox">
      <Checkbox
        checked={general.terminal.screenReaderMode}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftTerminalField({ key: 'screenReaderMode', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
