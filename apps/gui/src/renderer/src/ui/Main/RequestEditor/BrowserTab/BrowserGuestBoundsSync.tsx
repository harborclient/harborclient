import { useEffect, useRef, type RefObject } from 'react';

interface Props {
  /**
   * Browser tab id whose WebContentsView bounds are synced.
   */
  tabId: string;

  /**
   * Placeholder element whose getBoundingClientRect drives guest bounds.
   */
  hostRef: RefObject<HTMLDivElement | null>;
}

/**
 * Keeps the native WebContentsView aligned with a React placeholder rectangle.
 *
 * Observes resize of the host and window so sidebar/footer layout changes
 * reposition the guest. Does not create or destroy the guest.
 *
 * @param props - Tab id and host element ref.
 * @returns null (side-effect only).
 */
export function BrowserGuestBoundsSync({ tabId, hostRef }: Props): null {
  const frameRef = useRef<number | null>(null);

  /**
   * Measures the placeholder and pushes bounds to the main-process guest.
   */
  useEffect(() => {
    /**
     * Reads the host rect and invokes browserSetBounds.
     */
    const publishBounds = (): void => {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      const rect = host.getBoundingClientRect();
      void window.api.browserSetBounds(tabId, {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    };

    /**
     * Coalesces rapid resize events into one bounds publish per frame.
     */
    const schedulePublish = (): void => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        publishBounds();
      });
    };

    publishBounds();

    const host = hostRef.current;
    const observer =
      host && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedulePublish) : null;
    if (host && observer) {
      observer.observe(host);
    }

    window.addEventListener('resize', schedulePublish);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
      observer?.disconnect();
      window.removeEventListener('resize', schedulePublish);
    };
  }, [tabId, hostRef]);

  return null;
}
