/**
 * Default live-region semantics for non-blocking toast messages.
 */
export const DEFAULT_TOAST_ARIA_PROPS = {
  'role': 'status',
  'aria-live': 'polite',
  'aria-atomic': true
} as const;

/**
 * Live-region semantics for success toasts.
 */
export const SUCCESS_TOAST_ARIA_PROPS = {
  'role': 'status',
  'aria-live': 'polite',
  'aria-atomic': true
} as const;

/**
 * Live-region semantics for error toasts that should interrupt more urgently.
 */
export const ERROR_TOAST_ARIA_PROPS = {
  'role': 'alert',
  'aria-live': 'assertive',
  'aria-atomic': true
} as const;

/**
 * Live-region semantics for custom plugin theme prompt toasts, which bypass
 * react-hot-toast's default ToastBar aria wrapper.
 */
export const THEME_PROMPT_TOAST_LIVE_PROPS = {
  'role': 'status',
  'aria-live': 'polite',
  'aria-atomic': true
} as const;
