import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { APPEARANCE_DISPLAY_DEFAULTS } from '../appearanceDefaults';
import { SettingField } from '../components/SettingField';

/**
 * Storage-location badge visibility toggle. Applies immediately via sidebar
 * expansion state (same source as View → Appearance).
 */
export function AppearanceShowStorageLocationBadgesField(): JSX.Element {
  const { showStorageLocationBadges, setShowStorageLocationBadges } = useSidebarExpansion();

  return (
    <SettingField
      settingId="appearance.showStorageLocationBadges"
      layout="checkbox"
      live={{
        value: showStorageLocationBadges,
        defaultValue: APPEARANCE_DISPLAY_DEFAULTS.showStorageLocationBadges,
        onReset: () =>
          setShowStorageLocationBadges(APPEARANCE_DISPLAY_DEFAULTS.showStorageLocationBadges)
      }}
    >
      <Checkbox
        checked={showStorageLocationBadges}
        onChange={(event) => setShowStorageLocationBadges(event.target.checked)}
      />
    </SettingField>
  );
}
