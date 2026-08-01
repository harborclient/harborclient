/**
 * DOM id of the footer terminal {@link FooterPanel} root.
 */
export const TERMINAL_PANEL_ID = 'footer-terminal-panel';

/**
 * Toggle callback registered by {@link TerminalPanel} while the panel is open.
 */
let toggleHandler: (() => void) | null = null;

/**
 * Registers the terminal find toggle invoked by the find shortcut when focus is
 * inside the terminal panel.
 *
 * @param handler - Opens or closes the slide-down terminal search bar.
 * @returns Disposer that clears the registration when it still owns the slot.
 */
export function registerTerminalFindToggle(handler: () => void): () => void {
  toggleHandler = handler;
  return () => {
    if (toggleHandler === handler) {
      toggleHandler = null;
    }
  };
}

/**
 * Returns whether keyboard focus is inside the footer terminal panel.
 *
 * Used so CmdOrCtrl+F (or the configured find accelerator) toggles terminal
 * search instead of focusing sidebar search.
 *
 * @returns True when `document.activeElement` is within the terminal panel.
 */
export function isTerminalFindContextActive(): boolean {
  const panel = document.getElementById(TERMINAL_PANEL_ID);
  const active = document.activeElement;
  return panel != null && active instanceof Node && panel.contains(active);
}

/**
 * Toggles terminal search when a handler is registered and focus is in the panel.
 *
 * @returns True when the find shortcut was handled by the terminal.
 */
export function tryToggleTerminalFind(): boolean {
  if (toggleHandler == null || !isTerminalFindContextActive()) {
    return false;
  }

  toggleHandler();
  return true;
}

/**
 * Clears the registered toggle handler. Intended for unit tests only.
 */
export function clearTerminalFindToggle(): void {
  toggleHandler = null;
}
