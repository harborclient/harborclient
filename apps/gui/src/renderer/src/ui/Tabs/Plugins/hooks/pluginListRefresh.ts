/**
 * Returns whether a plugin list refresh should flip the global loading flag.
 *
 * Only the first load should unmount the installed grid. Later refreshes (toggle,
 * reload, `plugins:changed`) must update in place so the page does not blink.
 *
 * @param hasLoadedOnce - Whether a successful list fetch has completed.
 * @returns True when the UI should show the initial loading state.
 */
export function shouldSetLoadingForPluginListRefresh(hasLoadedOnce: boolean): boolean {
  return !hasLoadedOnce;
}

/**
 * Reuses an in-flight promise so concurrent refresh callers share one IPC round-trip.
 *
 * Action handlers often call `refresh()` while the main process also emits
 * `plugins:changed`, which would otherwise start two identical fetches.
 *
 * @param inFlightRef - Mutable ref holding the active promise, or null when idle.
 * @param start - Factory that starts a new refresh when none is in flight.
 * @returns The shared in-flight promise, or a newly started one.
 */
export function coalesceInFlightRefresh<T>(
  inFlightRef: { current: Promise<T> | null },
  start: () => Promise<T>
): Promise<T> {
  if (inFlightRef.current) {
    return inFlightRef.current;
  }

  const promise = start().finally(() => {
    if (inFlightRef.current === promise) {
      inFlightRef.current = null;
    }
  });
  inFlightRef.current = promise;
  return promise;
}
