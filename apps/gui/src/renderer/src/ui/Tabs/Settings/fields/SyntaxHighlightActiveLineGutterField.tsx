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
 * CodeMirror active line gutter highlight toggle backed by the shared settings draft.
 */
export function SyntaxHighlightActiveLineGutterField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="syntax.highlightActiveLineGutter" layout="checkbox">
      <Checkbox
        checked={general.codeEditorSetup.highlightActiveLineGutter}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftCodeEditorSetupField({
              key: 'highlightActiveLineGutter',
              value: event.target.checked
            })
          )
        }
      />
    </SettingField>
  );
}
