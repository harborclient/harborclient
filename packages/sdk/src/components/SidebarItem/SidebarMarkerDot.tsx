import type { JSX } from 'react';

interface Props {
  /**
   * Marker value as a CSS color string, or null/undefined to hide the dot.
   */
  marker: string | null | undefined;

  /**
   * When false, suppresses the dot even when a marker is assigned.
   */
  visible?: boolean;

  /**
   * Accessible label when the dot conveys meaning without visible text.
   */
  label?: string;
}

/**
 * Renders a small colored circle beside a sidebar row when a marker is assigned
 * and visibility is enabled.
 */
export function SidebarMarkerDot({ marker, visible = true, label }: Props): JSX.Element | null {
  if (!visible || marker == null || marker.trim() === '') {
    return null;
  }

  return (
    <span
      className="inline-block h-4 w-4 shrink-0 rounded-full"
      style={{ backgroundColor: marker }}
      {...(label != null ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
