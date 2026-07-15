/**
 * Tailwind classes for one search result row in the command palette.
 *
 * @param active - Whether this row is keyboard- or pointer-highlighted.
 */
export function searchResultRowClass(active: boolean): string {
  const base =
    'flex w-full min-w-0 flex-col items-stretch gap-0 rounded-md border-none px-1.5 py-0.5 text-left app-no-drag';
  return active
    ? `${base} cursor-pointer bg-selection`
    : `${base} cursor-pointer hover:bg-selection/60`;
}
