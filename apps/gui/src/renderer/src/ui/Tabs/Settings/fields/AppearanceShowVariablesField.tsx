import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectShowVariables, setShowVariables } from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Footer variables panel visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 */
export function AppearanceShowVariablesField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowVariables);

  return (
    <SettingField settingId="appearance.showVariables" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowVariables(event.target.checked))}
      />
    </SettingField>
  );
}
