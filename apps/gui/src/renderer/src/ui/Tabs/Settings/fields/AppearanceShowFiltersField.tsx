import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { SettingField } from '../components/SettingField';

/**
 * Section filter control visibility toggle. Applies immediately via sidebar
 * expansion state; turning off clears active section filters (same as View →
 * Appearance).
 *
 * TODO(settings-modified): appearance.showFilters — live sidebarExpansion.
 */
export function AppearanceShowFiltersField(): JSX.Element {
  const { showFilters, toggleFilters } = useSidebarExpansion();

  return (
    <SettingField settingId="appearance.showFilters" layout="checkbox">
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
