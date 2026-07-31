import { useEffect } from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveBrowserTab } from '#/renderer/src/store/selectors';
import {
  selectActivePluginFooterPanelId,
  selectShowConsole,
  selectShowLiveServerLogs,
  selectShowMcp,
  selectShowTerminal,
  selectShowVariables
} from '#/renderer/src/store/slices/navigationSlice';
import {
  selectHasBlockingModal,
  selectLiveServerModal
} from '#/renderer/src/store/slices/modalsSlice';
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
 * @param liveServerEditorOpen - Live server create/edit footer panel open.
 * @param showLiveServerLogs - Live server logs footer panel open.
 * @returns True when at least one footer panel should cover the live page.
 */
export function isAnyFooterPanelOpen(
  showConsole: boolean,
  showVariables: boolean,
  showMcp: boolean,
  showTerminal: boolean,
  activePluginFooterPanelId: string | null,
  liveServerEditorOpen = false,
  showLiveServerLogs = false
): boolean {
  return (
    showConsole ||
    showVariables ||
    showMcp ||
    showTerminal ||
    activePluginFooterPanelId != null ||
    liveServerEditorOpen ||
    showLiveServerLogs
  );
}

/**
 * Returns whether the active browser guest should be freeze-framed for overlays.
 *
 * @param input - Blocking-modal and footer open flags.
 * @returns True when a Redux blocking modal or footer panel needs the guest hidden.
 */
export function shouldCoverBrowserGuest(input: {
  hasBlockingModal: boolean;
  footerOpen: boolean;
}): boolean {
  return input.hasBlockingModal || input.footerOpen;
}

/**
 * Covers the active live-page WebContentsView while any Redux blocking modal or
 * footer panel is open.
 *
 * Native guests paint above renderer HTML, so Confirm/Alert modals and
 * slide-up footer panels (including the live server editor) must freeze and
 * hide the guest to appear in front. Mount once at the app root so every
 * blocking modal is covered without per-modal hooks that race on uncover.
 */
export function useBrowserGuestOverlayCover(): void {
  const hasBlockingModal = useAppSelector(selectHasBlockingModal);
  const showConsole = useAppSelector(selectShowConsole);
  const showVariables = useAppSelector(selectShowVariables);
  const showMcp = useAppSelector(selectShowMcp);
  const showTerminal = useAppSelector(selectShowTerminal);
  const showLiveServerLogs = useAppSelector(selectShowLiveServerLogs);
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);
  const liveServerEditorOpen = useAppSelector(selectLiveServerModal) != null;
  const activeBrowserTab = useAppSelector(selectActiveBrowserTab);

  const footerOpen = isAnyFooterPanelOpen(
    showConsole,
    showVariables,
    showMcp,
    showTerminal,
    activePluginFooterPanelId,
    liveServerEditorOpen,
    showLiveServerLogs
  );
  const needsCover = shouldCoverBrowserGuest({ hasBlockingModal, footerOpen });
  const browserTabId = activeBrowserTab?.tabId ?? null;

  /**
   * Freezes the guest when a blocking modal or footer panel opens over a browser
   * tab; restores when every overlay reason is gone.
   */
  useEffect(() => {
    if (!needsCover || !browserTabId) {
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
  }, [needsCover, browserTabId]);
}
