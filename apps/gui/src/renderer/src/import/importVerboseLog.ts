/**
 * Logs one import pipeline step from the host renderer to the main-process verbose stream.
 *
 * @param step - Short step label such as `menu thunk start`.
 * @param detail - Optional structured fields for the step.
 */
export function logImportVerbose(step: string, detail?: Record<string, unknown>): void {
  try {
    void window.api.logVerbose(step, detail);
  } catch {
    // Best-effort logging when preload is unavailable in tests.
  }
}
