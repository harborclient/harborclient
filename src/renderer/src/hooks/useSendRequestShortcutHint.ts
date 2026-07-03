import { useEffect, useState } from 'react';
import { formatAcceleratorDisplay } from '#/shared/shortcuts';

const DEFAULT_SEND_REQUEST_ACCELERATOR = 'F5';

/**
 * Capitalizes each segment of a settings-style accelerator string for hint display.
 *
 * @param display - Lowercase hyphen-separated accelerator from {@link formatAcceleratorDisplay}.
 * @returns Display string such as `F5` or `Ctrl-Shift-N`.
 */
function capitalizeShortcutDisplay(display: string): string {
  return display
    .split('-')
    .map((part) => {
      if (/^f\d+$/i.test(part)) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('-');
}

/**
 * Builds the empty-response hint from a resolved Send shortcut accelerator.
 *
 * @param accelerator - Electron accelerator string for the send-request binding.
 * @returns Hint such as "Press F5 to send request".
 */
function buildSendRequestShortcutHint(accelerator: string): string {
  const display = capitalizeShortcutDisplay(formatAcceleratorDisplay(accelerator));
  return `Press ${display} to send request.`;
}

const DEFAULT_SEND_REQUEST_SHORTCUT_HINT = buildSendRequestShortcutHint(
  DEFAULT_SEND_REQUEST_ACCELERATOR
);

/**
 * Resolves the Send request shortcut hint for the response empty state.
 *
 * Loads the effective send-request binding from settings on mount and formats it
 * for display. Falls back to the default F5 hint when IPC fails or the binding
 * is missing.
 *
 * @returns Hint text such as "Press F5 to send request".
 */
export function useSendRequestShortcutHint(): string {
  const [hint, setHint] = useState(DEFAULT_SEND_REQUEST_SHORTCUT_HINT);

  /**
   * Loads the configured send-request accelerator for the empty-state hint.
   */
  useEffect(() => {
    let cancelled = false;

    window.api
      .getShortcuts()
      .then((bindings) => {
        if (cancelled) {
          return;
        }

        const sendBinding = bindings.find((binding) => binding.id === 'send-request');
        if (sendBinding == null) {
          return;
        }

        setHint(buildSendRequestShortcutHint(sendBinding.accelerator));
      })
      .catch(() => {
        // Keep the default hint when shortcut settings cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return hint;
}
