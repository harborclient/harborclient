import type { StatusDotVariant } from '../StatusDot/index.js';
import { statusDotVariantClass } from '../StatusDot/index.js';

/**
 * Tailwind classes for sidebar source rows and HTTP method badges.
 */

/**
 * Tailwind classes for a sidebar source row (collection, folder, request, etc.).
 * Uses left padding only so trailing hamburger menus can share a right column
 * with section header Add/Erase actions (host CSS insets hamburgers slightly
 * right of header actions).
 *
 * @param selected - Whether this row is the active selection.
 * @param compact - When true, uses tighter vertical padding for top-level list rows.
 * @returns Combined Tailwind class string for the row container.
 */
export function sourceRow(selected: boolean, compact = false): string {
  const py = compact ? 'py-0' : 'py-0.5';
  return selected
    ? `group flex items-center gap-1 rounded-md bg-selection pl-1.5 pr-0 ${py} app-no-drag`
    : `group flex items-center gap-1 rounded-md pl-1.5 pr-0 ${py} hover:bg-selection/60 app-no-drag`;
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
 * Returns Tailwind classes for an HTTP method badge in the sidebar.
 *
 * @param method - HTTP method string.
 * @param methodColors - When false, uses neutral theme text instead of per-method colors.
 * @returns Combined Tailwind class string for the method badge.
 */
export function methodBadgeClass(method: string, methodColors = true): string {
  if (!methodColors) {
    return 'hc-method-badge text-text';
  }
  return METHOD_CLASSES[method.toLowerCase()] ?? 'hc-method-badge text-text';
}

/**
 * Returns Tailwind classes for a collection markdown document icon in the sidebar.
 *
 * @param methodColors - When false, uses neutral theme text instead of the doc-markdown accent.
 * @returns Tailwind text color class for the document icon.
 */
export function documentIconClass(methodColors = true): string {
  return methodColors ? 'text-doc-markdown' : 'text-text';
}

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
 * Expand/collapse chevron button (collection and folder rows). 16×16 hit target
 * sized to match Cursor’s file explorer twistie.
 */
export const SIDEBAR_CHEVRON_BUTTON_CLASS =
  'app-no-drag inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-text';

/**
 * Expand/collapse chevron glyph size (12×12), forced past Font Awesome's
 * text-relative dimensions to match Cursor’s explorer carets.
 */
export const SIDEBAR_CHEVRON_ICON_CLASS = '!h-3 !w-3';

/**
 * Section-header chevron slot: tight left inset and 16×16 alignment box for the
 * glyph when the whole header toggles expand/collapse.
 */
export const SIDEBAR_CHEVRON_SLOT_CLASS =
  'ms-1 inline-flex h-4 w-4 shrink-0 items-center justify-center';

/**
 * Gap between a row chevron button and its label, matching Cursor’s explorer
 * spacing (~10px).
 */
export const SIDEBAR_CHEVRON_LABEL_OFFSET_CLASS = 'ml-2.5';
