import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectShowConsole, setShowConsole } from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Footer console panel visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 */
export function AppearanceShowConsoleField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowConsole);

  return (
    <SettingField settingId="appearance.showConsole" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowConsole(event.target.checked))}
      />
    </SettingField>
  );
}
