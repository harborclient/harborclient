import type { JSX } from 'react';

/**
 * Horizontal hairline divider between {@link SidebarRail} navigation items.
 *
 * Spans the full rail width (no horizontal inset) so separators read as
 * section boundaries. Uses the `sidebar-rail-separator` theme color token
 * (defaults to a soft mix of rail fill and rail text). Decorative only —
 * hidden from the accessibility tree so focus stays on tabs.
 */
export function SidebarRailSeparator(): JSX.Element {
  return (
    <div
      className="hc-sidebar-rail-separator h-px w-full shrink-0 bg-sidebar-rail-separator"
      aria-hidden
    />
  );
}
