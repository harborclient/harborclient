import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { APPEARANCE_DISPLAY_DEFAULTS } from '../appearanceDefaults';
import { SettingField } from '../components/SettingField';

/**
 * Section filter control visibility toggle. Applies immediately via sidebar
 * expansion state; turning off clears active section filters (same as View →
 * Appearance).
 */
export function AppearanceShowFiltersField(): JSX.Element {
  const { showFilters, toggleFilters } = useSidebarExpansion();

  return (
    <SettingField
      settingId="appearance.showFilters"
      layout="checkbox"
      live={{
        value: showFilters,
        defaultValue: APPEARANCE_DISPLAY_DEFAULTS.showFilters,
        onReset: () => {
          if (showFilters !== APPEARANCE_DISPLAY_DEFAULTS.showFilters) {
            toggleFilters();
          }
        }
      }}
    >
      <Checkbox
        checked={showFilters}
        onChange={(event) => {
          if (event.target.checked !== showFilters) {
            toggleFilters();
          }
        }}
      />
    </SettingField>
  );
}
