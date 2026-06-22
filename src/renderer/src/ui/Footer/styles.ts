/**
 * Compact segment button styles for the footer bar.
 */
export function footerSegment(active: boolean): string {
  return active
    ? 'cursor-pointer rounded-[5px] border-none bg-surface px-2 py-0.5 text-[14px] text-text shadow-sm app-no-drag'
    : 'cursor-pointer rounded-[5px] border-none bg-transparent px-2 py-0.5 text-[14px] text-muted hover:text-text app-no-drag';
}

/**
 * Square icon toggle styles for footer sidebar buttons.
 *
 * @param active - Whether the associated sidebar is currently visible.
 */
export function footerIconButton(active: boolean): string {
  return active
    ? 'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-surface text-text shadow-sm app-no-drag'
    : 'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted hover:bg-selection hover:text-text app-no-drag';
}
