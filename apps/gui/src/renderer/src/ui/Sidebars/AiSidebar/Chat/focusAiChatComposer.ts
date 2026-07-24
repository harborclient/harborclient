/** DOM id prefix for AI chat tab panels. */
export const AI_CHAT_PANEL_ID_PREFIX = 'ai-chat-panel-';

/** Maximum animation frames to retry focusing the composer after React updates. */
const FOCUS_COMPOSER_MAX_ATTEMPTS = 8;

/** Selector matching the CodeMirror chat message textbox inside a chat panel. */
const COMPOSER_TEXTBOX_SELECTOR = '[role="textbox"][aria-label="Chat message"]';

/**
 * Builds the DOM id for an AI chat tab panel.
 *
 * @param chatId - Open chat id.
 * @returns Element id used by the AI chat tab panel container.
 */
export function aiChatPanelElementId(chatId: number): string {
  return `${AI_CHAT_PANEL_ID_PREFIX}${chatId}`;
}

/**
 * Schedules `tryFocus` on animation frames until it returns true or attempts are exhausted.
 *
 * Used when the composer remounts (for example after a new chat tab) and the CodeMirror view
 * is not yet available on the first paint.
 *
 * @param tryFocus - Returns true when focus landed successfully.
 * @param maxAttempts - Maximum animation-frame retries before giving up.
 */
export function runWhenComposerReady(
  tryFocus: () => boolean,
  maxAttempts = FOCUS_COMPOSER_MAX_ATTEMPTS
): void {
  let attempts = 0;

  /**
   * Attempts focus and schedules another frame when the composer is not ready yet.
   */
  const tryOnce = (): void => {
    if (tryFocus() || attempts >= maxAttempts) {
      return;
    }

    attempts += 1;
    requestAnimationFrame(tryOnce);
  };

  requestAnimationFrame(tryOnce);
}

/**
 * Moves keyboard focus to the chat composer textbox inside the given chat panel.
 *
 * Targets the composer specifically (not the first focusable in the panel) so Arrow Down from
 * a chat tab does not land on message actions such as code-block copy buttons.
 *
 * @param chatId - Open chat id whose linked panel should receive focus.
 * @returns True when focus moved onto the composer textbox.
 */
export function focusAiChatComposerInPanel(chatId: number): boolean {
  const panel = document.getElementById(aiChatPanelElementId(chatId));
  if (panel == null) {
    return false;
  }

  const textbox = panel.querySelector<HTMLElement>(COMPOSER_TEXTBOX_SELECTOR);
  if (textbox == null || typeof textbox.focus !== 'function') {
    return false;
  }

  textbox.focus();
  return document.activeElement === textbox || textbox.contains(document.activeElement);
}

/**
 * Retries focusing the composer across animation frames until React commits the panel.
 *
 * @param chatId - Open chat id whose linked panel should receive focus.
 */
export function focusAiChatComposerWhenMounted(chatId: number): void {
  runWhenComposerReady(() => focusAiChatComposerInPanel(chatId));
}
