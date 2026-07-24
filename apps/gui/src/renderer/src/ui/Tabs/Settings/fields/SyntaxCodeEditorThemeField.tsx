import { Select, CODE_EDITOR_THEME_OPTIONS } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { GeneralSettings } from '#/shared/types';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftCodeEditorTheme
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * CodeMirror theme field backed by the shared settings draft.
 */
export function SyntaxCodeEditorThemeField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="syntax.codeEditorTheme">
      <Select
        value={general.codeEditorTheme}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftCodeEditorTheme(event.target.value as GeneralSettings['codeEditorTheme'])
          )
        }
      >
        {CODE_EDITOR_THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </SettingField>
  );
}
