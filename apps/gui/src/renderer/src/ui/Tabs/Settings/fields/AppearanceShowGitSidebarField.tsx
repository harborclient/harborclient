import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectShowGitSidebar,
  setShowGitSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Git sidebar visibility toggle. Applies immediately via panel layout state
 * (same source as View → Appearance).
 *
 * TODO(settings-modified): appearance.showGitSidebar — live navigation / panelLayout.
 */
export function AppearanceShowGitSidebarField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowGitSidebar);

  return (
    <SettingField settingId="appearance.showGitSidebar" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowGitSidebar(event.target.checked))}
      />
    </SettingField>
  );
}
