import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectShowRail, setShowRail } from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Activity rail visibility toggle. Applies immediately via panel layout state
 * (same source as View → Appearance).
 *
 * TODO(settings-modified): appearance.showRail — live navigation / panelLayout.
 */
export function AppearanceShowRailField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowRail);

  return (
    <SettingField settingId="appearance.showRail" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowRail(event.target.checked))}
      />
    </SettingField>
  );
}
