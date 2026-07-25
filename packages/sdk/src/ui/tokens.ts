/**
 * HarborClient CSS custom property names for HTTP method badge colors.
 */
export const METHOD_COLOR_TOKENS = {
  get: '--mac-method-get',
  post: '--mac-method-post',
  put: '--mac-method-put',
  patch: '--mac-method-patch',
  delete: '--mac-method-delete',
  head: '--mac-method-head',
  options: '--mac-method-options'
} as const;

/** Tailwind classes for HTTP method labels matching HarborClient tokens. */
const METHOD_CLASSES: Record<string, string> = {
  get: 'hc-method-badge text-method-get',
  post: 'hc-method-badge text-method-post',
  put: 'hc-method-badge text-method-put',
  patch: 'hc-method-badge text-method-patch',
  delete: 'hc-method-badge text-method-delete',
  head: 'hc-method-badge text-method-head',
  options: 'hc-method-badge text-method-options'
};

/**
 * Returns Tailwind classes for an HTTP method badge.
 *
 * @param method - HTTP method string.
 */
export function methodColorClass(method: string): string {
  return METHOD_CLASSES[method.toLowerCase()] ?? 'hc-method-badge text-text';
}

/**
 * HarborClient CSS custom property names for HTTP status indicator colors.
 */
export const STATUS_COLOR_TOKENS = {
  success: '--mac-success',
  warning: '--mac-warning',
  danger: '--mac-danger',
  info: '--mac-info'
} as const;

/**
 * Status dot background class for an HTTP response code.
 *
 * @param status - HTTP status code.
 */
export function statusColorClass(status: number): string {
  if (status >= 200 && status < 300) {
    return 'bg-success';
  }
  if (status >= 300 && status < 400) {
    return 'bg-warning';
  }
  if (status >= 400) {
    return 'bg-danger';
  }
  return 'bg-info';
}
