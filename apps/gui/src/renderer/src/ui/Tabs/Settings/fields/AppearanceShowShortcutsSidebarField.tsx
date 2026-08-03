import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectShowShortcutsSidebar,
  setShowShortcutsSidebar
} from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Shortcuts sidebar visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 */
export function AppearanceShowShortcutsSidebarField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowShortcutsSidebar);

  return (
    <SettingField settingId="appearance.showShortcutsSidebar" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowShortcutsSidebar(event.target.checked))}
      />
    </SettingField>
  );
}
