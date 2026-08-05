/**
 * Shared macOS-style Tailwind class strings for SDK UI components.
 */

export const segmentGroup =
  'flex min-w-0 max-w-full w-full p-3 border-b border-separator shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]';

const segmentFocusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * Tailwind classes for a segmented control button.
 *
 * @param active - Whether this segment is selected.
 */
export function segment(active: boolean): string {
  return active
    ? `cursor-pointer rounded-md border-none bg-selection px-3 h-[32px] leading-none text-text ${segmentFocusVisible}`
    : `cursor-pointer rounded-md border-none bg-transparent px-3 h-[32px] leading-none text-muted hover:text-text ${segmentFocusVisible}`;
}

/**
 * Active/inactive surface classes for a document-style tab in the tab bar.
 *
 * @param active - Whether this tab is the selected editor.
 * @returns Border, background, and text color classes for the tab shell.
 *          The active tab uses opaque `bg-surface` and a matching bottom
 *          border so it merges with the panel below. Inactive tabs draw
 *          their own bottom separator (the bar container has none) so the
 *          rule remains visible under them. Both states reserve the same
 *          bottom border width for height alignment.
 */
export function tabItem(active: boolean): string {
  return active
    ? 'relative z-[1] border-separator/70 border-b-tab-active bg-tab-active text-tab-text [border-bottom-width:var(--mac-tab-border-width)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
    : 'border-separator/50 border-b-separator/50 bg-tab-inactive text-tab-text-inactive [border-bottom-width:var(--mac-tab-border-width)] hover:bg-tab-hover hover:text-tab-text focus-visible:bg-tab-hover focus-visible:text-tab-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent';
}
