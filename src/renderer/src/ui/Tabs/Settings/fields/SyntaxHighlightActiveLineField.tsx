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
 * CodeMirror active line highlight toggle backed by the shared settings draft.
 */
export function SyntaxHighlightActiveLineField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="syntax.highlightActiveLine" layout="checkbox">
      <Checkbox
        checked={general.codeEditorSetup.highlightActiveLine}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftCodeEditorSetupField({
              key: 'highlightActiveLine',
              value: event.target.checked
            })
          )
        }
      />
    </SettingField>
  );
}
