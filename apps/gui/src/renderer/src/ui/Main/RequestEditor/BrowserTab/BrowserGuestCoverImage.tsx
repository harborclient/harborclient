import { useEffect, useState, type JSX } from 'react';
import { getBrowserGuestCover, subscribeBrowserGuestCover } from './browserGuestCover';

interface Props {
  /**
   * Browser tab id that owns this guest placeholder.
   */
  tabId: string;
}

/**
 * Shows a frozen viewport snapshot while the native WebContentsView is hidden
 * for an HTML overlay (for example the Linux application menu).
 *
 * @param props - Tab id for the guest host.
 * @returns Freeze-frame image when this tab is covered; otherwise null.
 */
export function BrowserGuestCoverImage({ tabId }: Props): JSX.Element | null {
  const [dataUrl, setDataUrl] = useState<string | null>(() => {
    const cover = getBrowserGuestCover();
    return cover?.tabId === tabId ? cover.dataUrl : null;
  });

  /**
   * Keeps the freeze frame in sync with cover/uncover calls from overlays.
   */
  useEffect(() => {
    /**
     * Reads the active cover and updates local image state for this tab.
     */
    const sync = (): void => {
      const cover = getBrowserGuestCover();
      setDataUrl(cover?.tabId === tabId ? cover.dataUrl : null);
    };
    sync();
    return subscribeBrowserGuestCover(sync);
  }, [tabId]);

  if (!dataUrl) {
    return null;
  }

  return (
    <img
      src={dataUrl}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      draggable={false}
    />
  );
}
