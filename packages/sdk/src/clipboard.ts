import type { PluginContext } from './types.js';

/**
 * Options for {@link copyToClipboard}.
 */
export interface CopyToClipboardOptions {
  /**
   * Success toast message shown when copy succeeds.
   */
  toast?: string;

  /**
   * Toast display duration in milliseconds.
   */
  duration?: number;
}

/**
 * Copies text to the clipboard with optional toast feedback.
 *
 * Prefer {@link PluginUi.copyToClipboard} on the host when available; this helper
 * works with any plugin context that exposes `ui.showToast`.
 *
 * @param hc - Renderer plugin context.
 * @param text - Text to copy.
 * @param options - Optional toast message and duration.
 * @throws When clipboard access fails.
 */
export async function copyToClipboard(
  hc: PluginContext,
  text: string,
  options?: CopyToClipboardOptions
): Promise<void> {
  await navigator.clipboard.writeText(text);
  if (options?.toast) {
    hc.ui.showToast(options.toast, { duration: options.duration });
  }
}
