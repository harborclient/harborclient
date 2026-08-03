import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectShowTerminal, setShowTerminal } from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Footer terminal panel visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 */
export function AppearanceShowTerminalField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowTerminal);

  return (
    <SettingField settingId="appearance.showTerminal" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowTerminal(event.target.checked))}
      />
    </SettingField>
  );
}
