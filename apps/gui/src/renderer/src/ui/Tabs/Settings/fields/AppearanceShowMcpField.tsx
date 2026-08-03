import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectShowMcp, setShowMcp } from '#/renderer/src/store/slices/navigationSlice';
import { SettingField } from '../components/SettingField';

/**
 * Footer MCP panel visibility toggle. Applies immediately via panel layout
 * state (same source as View → Appearance).
 *
 * TODO(settings-modified): appearance.showMcp — live navigation / panelLayout.
 */
export function AppearanceShowMcpField(): JSX.Element {
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectShowMcp);

  return (
    <SettingField settingId="appearance.showMcp" layout="checkbox">
      <Checkbox
        checked={checked}
        onChange={(event) => dispatch(setShowMcp(event.target.checked))}
      />
    </SettingField>
  );
}
