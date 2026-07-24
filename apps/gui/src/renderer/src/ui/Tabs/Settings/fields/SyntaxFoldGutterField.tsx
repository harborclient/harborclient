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
 * CodeMirror fold gutter toggle backed by the shared settings draft.
 */
export function SyntaxFoldGutterField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="syntax.foldGutter" layout="checkbox">
      <Checkbox
        checked={general.codeEditorSetup.foldGutter}
        disabled={disabled}
        onChange={(event) =>
          dispatch(setDraftCodeEditorSetupField({ key: 'foldGutter', value: event.target.checked }))
        }
      />
    </SettingField>
  );
}
