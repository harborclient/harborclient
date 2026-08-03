import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { SettingField } from '../components/SettingField';

/**
 * Status indicator visibility toggle. Applies immediately via sidebar expansion
 * state (same source as View → Appearance).
 *
 * TODO(settings-modified): appearance.showIndicators — live sidebarExpansion.
 */
export function AppearanceShowIndicatorsField(): JSX.Element {
  const { showIndicators, setShowIndicators } = useSidebarExpansion();

  return (
    <SettingField settingId="appearance.showIndicators" layout="checkbox">
      <Checkbox
        checked={showIndicators}
        onChange={(event) => setShowIndicators(event.target.checked)}
      />
    </SettingField>
  );
}
