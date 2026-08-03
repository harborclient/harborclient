import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { APPEARANCE_DISPLAY_DEFAULTS } from '../appearanceDefaults';
import { SettingField } from '../components/SettingField';

/**
 * Status indicator visibility toggle. Applies immediately via sidebar expansion
 * state (same source as View → Appearance).
 */
export function AppearanceShowIndicatorsField(): JSX.Element {
  const { showIndicators, setShowIndicators } = useSidebarExpansion();

  return (
    <SettingField
      settingId="appearance.showIndicators"
      layout="checkbox"
      live={{
        value: showIndicators,
        defaultValue: APPEARANCE_DISPLAY_DEFAULTS.showIndicators,
        onReset: () => setShowIndicators(APPEARANCE_DISPLAY_DEFAULTS.showIndicators)
      }}
    >
      <Checkbox
        checked={showIndicators}
        onChange={(event) => setShowIndicators(event.target.checked)}
      />
    </SettingField>
  );
}
