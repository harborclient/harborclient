import { useEffect } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveBrowserTab } from '#/renderer/src/store/selectors';
import { selectOpenExternalLinkModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  coverBrowserGuestForOverlay,
  uncoverBrowserGuest
} from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/browserGuestCover';
import { hasBrowserGuest } from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/browserGuestRegistry';

/**
 * Covers the active live-page WebContentsView while the open-external-link modal is shown.
 *
 * Native guests paint above renderer HTML, so the confirm dialog would sit behind the
 * page without freezing and hiding the guest (same pattern as footer panels / Linux menus).
 */
export function useOpenExternalLinkGuestCover(): void {
  const modal = useAppSelector(selectOpenExternalLinkModal);
  const activeBrowserTab = useAppSelector(selectActiveBrowserTab);
  const browserTabId = activeBrowserTab?.tabId ?? null;
  const modalOpen = modal != null;

  /**
   * Freezes the guest when the external-link confirm opens over a browser tab; restores on close.
   */
  useEffect(() => {
    if (!modalOpen || !browserTabId || !hasBrowserGuest(browserTabId)) {
      return;
    }

    const tabId = browserTabId;
    let cancelled = false;

    /**
     * Applies the cover once the effect is still current.
     */
    async function cover(): Promise<void> {
      await coverBrowserGuestForOverlay(tabId);
      if (cancelled) {
        await uncoverBrowserGuest();
      }
    }

    void cover();

    return () => {
      cancelled = true;
      void uncoverBrowserGuest();
    };
  }, [modalOpen, browserTabId]);
}
