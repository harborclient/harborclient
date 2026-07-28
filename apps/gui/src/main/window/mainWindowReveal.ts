import type { BrowserWindow } from 'electron';

/** How long to wait for the renderer to signal shell readiness before forcing reveal. */
export const UI_READY_TIMEOUT_MS = 15_000;

let registeredWindow: BrowserWindow | null = null;
let onReveal: ((trigger: string) => void) | null = null;
let revealed = false;
let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

/**
 * Clears any pending UI-ready timeout so a late reveal does not race the timer.
 */
function clearUiReadyTimeout(): void {
  if (timeoutHandle != null) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
}

/**
 * Registers the main window and its one-shot reveal callback.
 *
 * Replaces any previous registration so recreate paths (for example macOS
 * activate) always point at the live window.
 *
 * @param window - Main BrowserWindow created with `show: false`.
 * @param reveal - Callback that closes splash, shows the window, and restores presentation.
 */
export function registerMainWindowReveal(
  window: BrowserWindow,
  reveal: (trigger: string) => void
): void {
  clearUiReadyTimeout();
  registeredWindow = window;
  onReveal = reveal;
  revealed = false;
}

/**
 * Clears the reveal registry when the main window is destroyed.
 */
export function clearMainWindowReveal(): void {
  clearUiReadyTimeout();
  registeredWindow = null;
  onReveal = null;
  revealed = false;
}

/**
 * Returns the BrowserWindow currently registered for deferred reveal, if any.
 *
 * @returns Registered main window, or null when none is active.
 */
export function getRegisteredMainWindow(): BrowserWindow | null {
  if (registeredWindow && !registeredWindow.isDestroyed()) {
    return registeredWindow;
  }
  return null;
}

/**
 * Returns whether the main window has already been revealed once.
 *
 * @returns True after a successful {@link requestMainWindowReveal}.
 */
export function isMainWindowRevealed(): boolean {
  return revealed;
}

/**
 * Shows the main window exactly once when the renderer (or timeout) says ready.
 *
 * @param trigger - Name of the event that initiated the reveal, for logging.
 * @returns True when this call performed the reveal; false when already revealed or unregistered.
 */
export function requestMainWindowReveal(trigger: string): boolean {
  if (revealed || !onReveal) {
    return false;
  }
  revealed = true;
  clearUiReadyTimeout();
  onReveal(trigger);
  return true;
}

/**
 * Starts a timeout that forces reveal if the renderer never calls notifyUiReady.
 *
 * Call when the renderer finishes loading HTML so a hung bootstrap cannot leave
 * the splash forever. Idempotent across reloads: resets any previous timer.
 *
 * @param onTimeout - Optional hook invoked after the forced reveal (for logging).
 */
export function startUiReadyTimeout(onTimeout?: () => void): void {
  clearUiReadyTimeout();
  if (revealed || !onReveal) {
    return;
  }

  timeoutHandle = setTimeout(() => {
    timeoutHandle = null;
    if (revealed) {
      return;
    }
    console.warn(
      `Main window UI-ready timeout (${UI_READY_TIMEOUT_MS}ms); revealing without renderer signal`
    );
    requestMainWindowReveal('ui-ready-timeout');
    onTimeout?.();
  }, UI_READY_TIMEOUT_MS);
}

/**
 * Resets module state for unit tests simulating a fresh app start.
 */
export function resetMainWindowRevealForTests(): void {
  clearMainWindowReveal();
}
