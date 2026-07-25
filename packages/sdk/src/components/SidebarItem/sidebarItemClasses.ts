import type { StatusDotVariant } from '../StatusDot/index.js';
import { statusDotVariantClass } from '../StatusDot/index.js';

/**
 * Tailwind classes for sidebar source rows and HTTP method badges.
 */

/**
 * Tailwind classes for a sidebar source row (collection, folder, request, etc.).
 *
 * @param selected - Whether this row is the active selection.
 * @param compact - When true, uses tighter vertical padding for top-level list rows.
 * @returns Combined Tailwind class string for the row container.
 */
export function sourceRow(selected: boolean, compact = false): string {
  const py = compact ? 'py-0' : 'py-0.5';
  return selected
    ? `group flex items-center gap-1 rounded-md bg-selection px-1.5 ${py} app-no-drag`
    : `group flex items-center gap-1 rounded-md px-1.5 ${py} hover:bg-selection/60 app-no-drag`;
}

/**
 * HTTP method color classes keyed by lowercase method name.
 */
export const METHOD_CLASSES: Record<string, string> = {
  get: 'hc-method-badge text-method-get',
  post: 'hc-method-badge text-method-post',
  put: 'hc-method-badge text-method-put',
  patch: 'hc-method-badge text-method-patch',
  delete: 'hc-method-badge text-method-delete',
  head: 'hc-method-badge text-method-head',
  options: 'hc-method-badge text-method-options'
};

/**
 * Status dot variant for an HTTP response code.
 *
 * @param status - HTTP status code, or 0 for network errors.
 * @returns Color preset for {@link StatusDot}.
 */
export function statusDotVariant(status: number): StatusDotVariant {
  if (status === 0) return 'danger';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'warning';
  if (status >= 400) return 'danger';
  return 'info';
}

/**
 * Status dot color class for an HTTP response code.
 *
 * @param status - HTTP status code, or 0 for network errors.
 * @returns Tailwind background color class for the status dot.
 */
export function statusDotClass(status: number): string {
  return statusDotVariantClass(statusDotVariant(status));
}

/**
 * Standard primary button classes for sidebar item label areas.
 */
export const SIDEBAR_ITEM_BUTTON_CLASS =
  'flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag';

/**
 * Tailwind classes for the sortable row drag handle. Hidden until row hover or handle focus.
 */
export const SIDEBAR_DRAG_HANDLE_CLASS =
  'app-no-drag inline-flex h-4 w-4 shrink-0 cursor-grab items-center justify-center rounded border-none bg-transparent p-0 text-muted opacity-0 hover:text-text focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing group-hover:opacity-100';

/**
 * Extra left margin for document icons beside sortable request rows.
 * Combines with `SidebarDocumentItem`'s default `pl-1` so the glyph lines up
 * with method text (drag handle `w-4` + row `gap-1` + method badge `px-1` =
 * 24px total; `ml-5` provides the remaining 20px).
 */
export const SIDEBAR_DOCUMENT_ICON_REQUEST_ALIGN_CLASS = 'ml-5';
