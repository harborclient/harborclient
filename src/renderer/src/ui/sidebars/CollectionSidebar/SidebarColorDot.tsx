import type { JSX } from 'react';
import { useSidebarExpansion } from '#/renderer/src/ui/sidebars/CollectionSidebar/useSidebarExpansion';

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

  if (!showColorDots || color == null || color.trim() === '') {
    return null;
  }

  return (
    <span
      className="inline-block h-4 w-4 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden={label == null ? true : undefined}
      aria-label={label}
    />
  );
}
