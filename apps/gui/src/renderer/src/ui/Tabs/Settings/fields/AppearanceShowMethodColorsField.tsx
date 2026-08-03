import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { APPEARANCE_DISPLAY_DEFAULTS } from '../appearanceDefaults';
import { SettingField } from '../components/SettingField';

/**
 * Method badge color (highlights) visibility toggle. Applies immediately via
 * sidebar expansion state (same source as View → Appearance).
 */
export function AppearanceShowMethodColorsField(): JSX.Element {
  const { showMethodColors, setShowMethodColors } = useSidebarExpansion();

  return (
    <SettingField
      settingId="appearance.showMethodColors"
      layout="checkbox"
      live={{
        value: showMethodColors,
        defaultValue: APPEARANCE_DISPLAY_DEFAULTS.showMethodColors,
        onReset: () => setShowMethodColors(APPEARANCE_DISPLAY_DEFAULTS.showMethodColors)
      }}
    >
      <Checkbox
        checked={showMethodColors}
        onChange={(event) => setShowMethodColors(event.target.checked)}
      />
    </SettingField>
  );
}
