import type { IClipboardProvider } from '@xterm/addon-clipboard';

/**
 * xterm clipboard provider that reads and writes via Electron's main clipboard.
 *
 * OSC 52 sequences from the PTY have no browser user gesture, so
 * `navigator.clipboard` is unreliable. Preload exposes sync Electron
 * `clipboard` helpers on {@link window.api} instead.
 */
export class ElectronClipboardProvider implements IClipboardProvider {
  /**
   * Reads the system clipboard for an OSC 52 query.
   *
   * @param selection - OSC 52 selection type (ignored; Electron uses one clipboard).
   * @returns Current clipboard text.
   */
  readText(selection: string): string {
    void selection;
    return window.api.readClipboardText();
  }

  /**
   * Writes decoded OSC 52 payload text to the system clipboard.
   *
   * @param selection - OSC 52 selection type (ignored; Electron uses one clipboard).
   * @param text - Plain text decoded by the clipboard addon.
   */
  writeText(selection: string, text: string): void {
    void selection;
    window.api.writeClipboardText(text);
  }
}
