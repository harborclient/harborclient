import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectShowSidebar, setShowSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Collections sidebar visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 */
export function AppearanceShowSidebarField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowSidebar);

  return (
    <SettingField settingId="appearance.showSidebar" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowSidebar(event.target.checked))}
      />
    </SettingField>
  );
}
