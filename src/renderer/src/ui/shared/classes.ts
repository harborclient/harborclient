/**
 * Shared macOS-style Tailwind class strings.
 */

export const field =
  'rounded-md border border-separator bg-control px-2 py-1 text-[15px] text-text shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag';

export const segmentGroup =
  'inline-flex rounded-md p-0.5 shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)] app-no-drag';

/**
 * Tailwind classes for a segmented control button.
 *
 * @param active - Whether this segment is selected.
 */
export function segment(active: boolean): string {
  return active
    ? 'cursor-pointer rounded-[5px] border-none bg-control px-3 py-1 text-[15px] text-text shadow-sm app-no-drag'
    : 'cursor-pointer rounded-[5px] border-none bg-transparent px-3 py-1 text-[15px] text-muted hover:text-text app-no-drag';
}

/**
 * Tailwind classes for a sidebar source row (collection, folder, or request).
 *
 * @param selected - Whether this row is the active selection.
 */
export function sourceRow(selected: boolean): string {
  return selected
    ? 'group flex items-center gap-1 rounded-md bg-selection px-1.5 py-0.5 app-no-drag'
    : 'group flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-selection/60 app-no-drag';
}

/**
 * Active/inactive surface classes for a request tab in the tab bar.
 *
 * @param active - Whether this tab is the selected editor.
 * @returns Border, background, and text color classes for the tab shell.
 */
export function requestTabItem(active: boolean): string {
  return active
    ? 'border-separator bg-surface text-text'
    : 'border-transparent bg-transparent text-muted hover:bg-selection/60 hover:text-text';
}

export const separator = 'h-px bg-separator';

export const sectionLabel = 'mb-1 px-2 text-[14px] font-medium uppercase tracking-wide text-muted';

export const METHOD_CLASSES: Record<string, string> = {
  get: 'text-method-get',
  post: 'text-method-post',
  put: 'text-method-put',
  patch: 'text-method-patch',
  delete: 'text-method-delete',
  head: 'text-method-head',
  options: 'text-method-options'
};

/**
 * Status dot color class for an HTTP response code.
 *
 * @param status - HTTP status code, or 0 for network errors.
 */
export function statusDotClass(status: number): string {
  if (status === 0) return 'bg-danger';
  if (status >= 200 && status < 300) return 'bg-success';
  if (status >= 300 && status < 400) return 'bg-warning';
  if (status >= 400) return 'bg-danger';
  return 'bg-info';
}
