import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftCodeEditorSetupField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * CodeMirror line numbers toggle backed by the shared settings draft.
 */
export function SyntaxLineNumbersField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="syntax.lineNumbers" layout="checkbox">
      <Checkbox
        checked={general.codeEditorSetup.lineNumbers}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftCodeEditorSetupField({ key: 'lineNumbers', value: event.target.checked })
          )
        }
      />
    </SettingField>
  );
}
