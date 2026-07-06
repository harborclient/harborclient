/**
 * Returns whether the chat composer should submit on the current key event.
 *
 * @param key - Keyboard event key value.
 * @param shiftKey - Whether Shift is held.
 * @param ctrlKey - Whether Ctrl is held.
 * @param metaKey - Whether Meta/Cmd is held.
 * @param enterToSend - When true, plain Enter submits; when false, Ctrl/Cmd+Enter submits.
 * @returns True when the key event should trigger send.
 */
export function shouldSendChatOnKeyDown(
  key: string,
  shiftKey: boolean,
  ctrlKey: boolean,
  metaKey: boolean,
  enterToSend: boolean
): boolean {
  if (key !== 'Enter') {
    return false;
  }

  if (enterToSend) {
    return !shiftKey;
  }

  return ctrlKey || metaKey;
}
