import type { JSX } from 'react';

interface Props {
  /**
   * CSS color string to render, or null/undefined to hide the dot.
   */
  color: string | null | undefined;

  /**
   * When false, suppresses the dot even when a color is assigned.
   */
  visible?: boolean;

  /**
   * Accessible label when the dot conveys meaning without visible text.
   */
  label?: string;
}

/**
 * Renders a small colored circle beside a sidebar row when a color is assigned
 * and visibility is enabled.
 */
export function SidebarColorDot({ color, visible = true, label }: Props): JSX.Element | null {
  if (!visible || color == null || color.trim() === '') {
    return null;
  }

  return (
    <span
      className="inline-block h-4 w-4 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      {...(label != null ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
