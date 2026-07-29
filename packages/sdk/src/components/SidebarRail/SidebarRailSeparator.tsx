import type { JSX } from 'react';

/**
 * Horizontal hairline divider between {@link SidebarRail} navigation items.
 *
 * Spans the full rail width (no horizontal inset) so separators read as
 * section boundaries. Decorative only — keyboard focus stays on the items.
 */
export function SidebarRailSeparator(): JSX.Element {
  return (
    <div
      className="hc-sidebar-rail-separator h-px w-full shrink-0 bg-separator"
      role="separator"
      aria-hidden
    />
  );
}
