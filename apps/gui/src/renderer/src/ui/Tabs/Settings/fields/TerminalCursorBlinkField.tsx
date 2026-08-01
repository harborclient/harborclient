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
 * Terminal cursor blink toggle backed by the shared settings draft.
 */
export function TerminalCursorBlinkField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.cursorBlink" layout="checkbox">
      <Checkbox
        checked={general.terminal.cursorBlink}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftTerminalField({ key: 'cursorBlink', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
