import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectShowAiSidebar, setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Agent chat sidebar visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 */
export function AppearanceShowAiSidebarField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowAiSidebar);

  return (
    <SettingField settingId="appearance.showAiSidebar" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowAiSidebar(event.target.checked))}
      />
    </SettingField>
  );
}
