/**
 * Shared macOS-style Tailwind class strings for SDK UI components.
 */

export const segmentGroup =
  'inline-flex p-3 border-b border-separator w-full shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag';

const segmentFocusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * Tailwind classes for a segmented control button.
 *
 * @param active - Whether this segment is selected.
 */
export function segment(active: boolean): string {
  return active
    ? `cursor-pointer rounded-md border-none bg-selection px-3 py-1 text-text app-no-drag ${segmentFocusVisible}`
    : `cursor-pointer rounded-md border-none bg-transparent px-3 py-1 text-muted hover:text-text app-no-drag ${segmentFocusVisible}`;
}

/**
 * Active/inactive surface classes for a document-style tab in the tab bar.
 *
 * @param active - Whether this tab is the selected editor.
 * @returns Border, background, and text color classes for the tab shell.
 *          Active tabs use a 2px bottom underline; inactive tabs reserve the
 *          same space with a transparent bottom border.
 */
export function tabItem(active: boolean): string {
  return active
    ? 'border-separator/70 border-b-tab-underline bg-selection text-text [border-bottom-width:var(--mac-tab-border-width)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
    : 'border-separator/50 border-b-transparent bg-control/20 text-muted [border-bottom-width:var(--mac-tab-border-width)] hover:bg-selection/60 hover:text-text focus-visible:bg-selection/60 focus-visible:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent';
}
