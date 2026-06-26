import { useEffect, useRef, useState, type JSX } from 'react';
import { Spinner } from '#/renderer/src/components/Spinner';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectIsBusy } from '#/renderer/src/store/slices/uiSlice';

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 300;

/**
 * Global busy overlay: top progress bar, corner spinner, and wait cursor.
 * Delayed show avoids flashing on fast operations; min-visible avoids flicker.
 */
export function BusyIndicator(): JSX.Element | null {
  const isBusy = useAppSelector(selectIsBusy);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAtRef = useRef<number | null>(null);

  /**
   * Shows, hides, or extends the busy overlay based on global busy state.
   */
  useEffect(() => {
    if (isBusy) {
      if (hideTimerRef.current != null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (visible) {
        return;
      }

      if (showTimerRef.current == null) {
        showTimerRef.current = setTimeout(() => {
          showTimerRef.current = null;
          shownAtRef.current = Date.now();
          setVisible(true);
        }, SHOW_DELAY_MS);
      }

      return;
    }

    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (!visible) {
      return;
    }

    const elapsed = shownAtRef.current != null ? Date.now() - shownAtRef.current : MIN_VISIBLE_MS;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
  }, [isBusy, visible]);

  /**
   * Clears pending show/hide timers on unmount.
   */
  useEffect(() => {
    return () => {
      if (showTimerRef.current != null) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current != null) clearTimeout(hideTimerRef.current);
    };
  }, []);

  /**
   * Toggles the document wait cursor while the overlay is visible.
   */
  useEffect(() => {
    document.body.classList.toggle('app-busy', visible);
    return () => {
      document.body.classList.remove('app-busy');
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-separator"
        aria-hidden="true"
      >
        <div className="busy-progress-bar h-full w-1/3 bg-accent" />
      </div>
      <div
        className="pointer-events-none fixed right-3 top-3 z-[100] flex h-6 w-6 items-center justify-center rounded-full border border-separator bg-surface shadow-sm"
        role="status"
        aria-label="Working"
      >
        <Spinner size="sm" />
      </div>
    </>
  );
}
