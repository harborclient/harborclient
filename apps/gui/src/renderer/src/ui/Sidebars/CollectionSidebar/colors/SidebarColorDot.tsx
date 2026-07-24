import { SidebarColorDot as SdkSidebarColorDot } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';

interface Props {
  /**
   * CSS color string to render, or null/undefined to hide the dot.
   */
  color: string | null | undefined;

  /**
   * Accessible label when the dot conveys meaning without visible text.
   */
  label?: string;
}

/**
 * Renders a small colored circle beside a sidebar row when a color is assigned.
 * Respects the global color-dot visibility preference from sidebar expansion state.
 */
export function SidebarColorDot({ color, label }: Props): JSX.Element | null {
  const { showColorDots } = useSidebarExpansion();

  return <SdkSidebarColorDot color={color} visible={showColorDots} label={label} />;
}
