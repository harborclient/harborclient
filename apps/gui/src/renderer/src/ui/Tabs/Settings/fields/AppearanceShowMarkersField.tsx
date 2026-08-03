import { Checkbox } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { SettingField } from '../components/SettingField';

/**
 * Color marker dot visibility toggle. Applies immediately via sidebar expansion
 * state (same source as View → Appearance).
 *
 * TODO(settings-modified): appearance.showMarkers — live sidebarExpansion.
 */
export function AppearanceShowMarkersField(): JSX.Element {
  const { showMarkers, setShowMarkers } = useSidebarExpansion();

  return (
    <SettingField settingId="appearance.showMarkers" layout="checkbox">
      <Checkbox checked={showMarkers} onChange={(event) => setShowMarkers(event.target.checked)} />
    </SettingField>
  );
}
