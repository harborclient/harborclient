import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectShowRequestEditor,
  setShowRequestEditor
} from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Request editor pane visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 */
export function AppearanceShowRequestEditorField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowRequestEditor);

  return (
    <SettingField settingId="appearance.showRequestEditor" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowRequestEditor(event.target.checked))}
      />
    </SettingField>
  );
}
