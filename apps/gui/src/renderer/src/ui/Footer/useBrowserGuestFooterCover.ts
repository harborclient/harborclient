import { useEffect } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveBrowserTab } from '#/renderer/src/store/selectors';
import {
  selectActivePluginFooterPanelId,
  selectShowConsole,
  selectShowMcp,
  selectShowTerminal,
  selectShowVariables
} from '#/renderer/src/store/slices/navigationSlice';
import {
  coverBrowserGuestForOverlay,
  uncoverBrowserGuest
} from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/browserGuestCover';

/**
 * Returns whether any slide-up footer panel is currently open.
 *
 * @param showConsole - Console panel open.
 * @param showVariables - Variables panel open.
 * @param showMcp - MCP panel open.
 * @param showTerminal - Terminal panel open.
 * @param activePluginFooterPanelId - Active plugin footer panel id, if any.
 * @returns True when at least one footer panel should cover the live page.
 */
export function isAnyFooterPanelOpen(
  showConsole: boolean,
  showVariables: boolean,
  showMcp: boolean,
  showTerminal: boolean,
  activePluginFooterPanelId: string | null
): boolean {
  return (
    showConsole || showVariables || showMcp || showTerminal || activePluginFooterPanelId != null
  );
}

/**
 * Covers the active live-page WebContentsView while any footer panel is open.
 *
 * Native guests paint above renderer HTML, so slide-up footer panels must freeze
 * and hide the guest (same pattern as Linux app menus) to appear in front.
 */
export function useBrowserGuestFooterCover(): void {
  const showConsole = useAppSelector(selectShowConsole);
  const showVariables = useAppSelector(selectShowVariables);
  const showMcp = useAppSelector(selectShowMcp);
  const showTerminal = useAppSelector(selectShowTerminal);
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);
  const activeBrowserTab = useAppSelector(selectActiveBrowserTab);

  const footerOpen = isAnyFooterPanelOpen(
    showConsole,
    showVariables,
    showMcp,
    showTerminal,
    activePluginFooterPanelId
  );
  const browserTabId = activeBrowserTab?.tabId ?? null;

  /**
   * Freezes the guest when a footer panel opens over a browser tab; restores on close.
   */
  useEffect(() => {
    if (!footerOpen || !browserTabId) {
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
  }, [footerOpen, browserTabId]);
}
