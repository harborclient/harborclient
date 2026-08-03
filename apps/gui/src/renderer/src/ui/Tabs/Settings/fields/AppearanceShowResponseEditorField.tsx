import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectShowResponseEditor,
  setShowResponseEditor
} from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Response editor pane visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 *
 * TODO(settings-modified): appearance.showResponseEditor — live navigation /
 * panelLayout.
 */
export function AppearanceShowResponseEditorField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowResponseEditor);

  return (
    <SettingField settingId="appearance.showResponseEditor" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowResponseEditor(event.target.checked))}
      />
    </SettingField>
  );
}
