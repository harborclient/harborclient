/**
 * High-contrast theme palette (solid hex only).
 *
 * Values mirror `:root[data-theme='high-contrast']` in
 * `src/renderer/src/styles.css`. Contrast ratios are measured against
 * {@link HC_SURFACE} unless noted otherwise.
 */
export const HC_SURFACE = '#000000';

/** 21:1 on {@link HC_SURFACE}. */
export const HC_TEXT = '#ffffff';

/** 21:1 on {@link HC_SURFACE}. */
export const HC_TEXT_SECONDARY = '#ffffff';

/** ~14:1 on {@link HC_SURFACE}. */
export const HC_MUTED = '#d0d0d0';

/** ~7:1 on {@link HC_SURFACE} (UI/border minimum 3:1). */
export const HC_SEPARATOR = '#9e9e9e';

/** Solid field fill (~8% white on black). */
export const HC_FIELD = '#141414';

/** Selection background; white text on this color is >=7:1. */
export const HC_SELECTION = '#14487a';

/** ~8.6:1 on {@link HC_SURFACE}. */
export const HC_ACCENT = '#4dabff';

/** ~8.6:1 on {@link HC_SURFACE}. */
export const HC_DANGER = '#ff8a80';

/** ~11:1 on {@link HC_SURFACE}. */
export const HC_DANGER_LIGHT = '#ffb4af';

/** ~10:1 on {@link HC_SURFACE}. */
export const HC_WARNING = '#ffb340';

/** ~11:1 on {@link HC_SURFACE}. */
export const HC_SUCCESS = '#5ce06a';

/** 21:1 on {@link HC_SURFACE}. */
export const HC_INFO = '#ffffff';

/** Footer/separator accent; ~14:1 on {@link HC_SURFACE}. */
export const HC_RESIZE_HANDLE = '#ffd60a';

export const HC_METHOD_GET = HC_SUCCESS;
export const HC_METHOD_POST = HC_ACCENT;
export const HC_METHOD_PUT = HC_RESIZE_HANDLE;
export const HC_METHOD_PATCH = '#bf9bff';
export const HC_METHOD_DELETE = HC_DANGER;
export const HC_METHOD_HEAD = HC_TEXT;
export const HC_METHOD_OPTIONS = HC_TEXT;

/** Variable token highlight; >=7:1 on {@link HC_SURFACE}. */
export const HC_VARIABLE_TOKEN = '#5fe3f0';

/** Primary accent button label on {@link HC_RESIZE_HANDLE}. */
export const HC_PRIMARY_BUTTON_TEXT = '#000000';

/** Solid hover fill for resize separators. */
export const HC_SEPARATOR_HOVER = '#332b00';

/**
 * All high-contrast text colors validated against the black surface.
 */
export const HC_TEXT_ON_SURFACE = [
  HC_TEXT,
  HC_TEXT_SECONDARY,
  HC_MUTED,
  HC_ACCENT,
  HC_DANGER,
  HC_DANGER_LIGHT,
  HC_WARNING,
  HC_SUCCESS,
  HC_INFO,
  HC_METHOD_GET,
  HC_METHOD_POST,
  HC_METHOD_PUT,
  HC_METHOD_PATCH,
  HC_METHOD_DELETE,
  HC_METHOD_HEAD,
  HC_METHOD_OPTIONS,
  HC_RESIZE_HANDLE,
  HC_VARIABLE_TOKEN
] as const;
