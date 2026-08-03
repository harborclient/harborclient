import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { APPEARANCE_DISPLAY_DEFAULTS } from '../appearanceDefaults';
import { SettingField } from '../components/SettingField';

/**
 * Section sort control visibility toggle. Applies immediately via sidebar
 * expansion state; turning off resets section sorts to default (same as View →
 * Appearance).
 */
export function AppearanceShowSortingField(): JSX.Element {
  const { showSorting, toggleSorting } = useSidebarExpansion();

  return (
    <SettingField
      settingId="appearance.showSorting"
      layout="checkbox"
      live={{
        value: showSorting,
        defaultValue: APPEARANCE_DISPLAY_DEFAULTS.showSorting,
        onReset: () => {
          if (showSorting !== APPEARANCE_DISPLAY_DEFAULTS.showSorting) {
            toggleSorting();
          }
        }
      }}
    >
      <Checkbox
        checked={showSorting}
        onChange={(event) => {
          if (event.target.checked !== showSorting) {
            toggleSorting();
          }
        }}
      />
    </SettingField>
  );
}
