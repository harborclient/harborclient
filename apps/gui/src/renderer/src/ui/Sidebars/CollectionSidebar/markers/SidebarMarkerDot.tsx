import { SidebarMarkerDot as SdkSidebarMarkerDot } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';

interface Props {
  /**
   * CSS marker string to render, or null/undefined to hide the dot.
   */
  marker: string | null | undefined;

  /**
   * Accessible label when the dot conveys meaning without visible text.
   */
  label?: string;
}

/**
 * Renders a small colored circle beside a sidebar row when a marker is assigned.
 * Respects the global marker-dot visibility preference from sidebar expansion state.
 */
export function SidebarMarkerDot({ marker, label }: Props): JSX.Element | null {
  const { showMarkers } = useSidebarExpansion();

  return <SdkSidebarMarkerDot marker={marker} visible={showMarkers} label={label} />;
}
