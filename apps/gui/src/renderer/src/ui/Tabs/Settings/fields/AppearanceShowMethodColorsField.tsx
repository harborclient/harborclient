import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { SettingField } from '../components/SettingField';

/**
 * Method badge color (highlights) visibility toggle. Applies immediately via
 * sidebar expansion state (same source as View → Appearance).
 *
 * TODO(settings-modified): appearance.showMethodColors — live sidebarExpansion.
 */
export function AppearanceShowMethodColorsField(): JSX.Element {
  const { showMethodColors, setShowMethodColors } = useSidebarExpansion();

  return (
    <SettingField settingId="appearance.showMethodColors" layout="checkbox">
      <Checkbox
        checked={showMethodColors}
        onChange={(event) => setShowMethodColors(event.target.checked)}
      />
    </SettingField>
  );
}
