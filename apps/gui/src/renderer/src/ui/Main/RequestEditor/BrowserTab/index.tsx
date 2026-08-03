import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { Variable } from '@harborclient/core/types';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { buildBrowserHcScriptsPayload } from '#/renderer/src/store/browser/browserGuestPayload';
import { BrowserChrome } from './BrowserChrome';
import { BrowserGuestBoundsSync } from './BrowserGuestBoundsSync';
import { BrowserGuestCoverImage } from './BrowserGuestCoverImage';
import { BrowserScreenshotModeModal } from './BrowserScreenshotModeModal';
import { browserScreenshotDefaultFileName } from './browserScreenshotFileName';
import {
  coverBrowserGuestForOverlay,
  dismissBrowserGuestCover,
  getBrowserGuestCover,
  uncoverBrowserGuest
} from './browserGuestCover';
import { hasBrowserGuest, markBrowserGuestCreated } from './browserGuestRegistry';
import { mergeLivePageVariables } from './mergeLivePageVariables';

/**
 * Inline chrome/guest feedback for screenshot save results.
 *
 * Rendered above the WebContentsView so it is never covered by the native guest.
 */
type ScreenshotNotice = {
  /**
   * Visual tone for the notice.
   */
  tone: 'success' | 'error';

  /**
   * User-facing message.
   */
  message: string;
};

interface Props {
  /**
   * Browser tab rendered in the editor panel.
   */
  tab: BrowserTab;

  /**
   * Active collection/environment variables for the address bar.
   */
  variables: Variable[];

  /**
   * Opens settings to edit a variable from an address-bar token tooltip.
   *
   * @param key - Variable name from the hovered `{{key}}` token.
   */
  onEditVariables?: (key: string) => void;
}

/**
 * Embedded browser tab: chrome controls plus a placeholder for the WebContentsView guest.
 *
 * Creates the main-process guest on first mount, shows it while active, and hides it on
 * unmount without destroying so inactive browser tabs keep their session.
 *
 * @param props - Browser tab state, active variables, and optional edit-variable handler.
 * @returns Browser chrome and guest host.
 */
export function BrowserTabContent({ tab, variables, onEditVariables }: Props): JSX.Element {
  const snippets = useAppSelector(selectSnippets);
  const { aiAvailable, copyToChat } = useCopyToChat();
  const hostRef = useRef<HTMLDivElement>(null);
  /**
   * When true, the screenshot mode chooser is open.
   */
  const [screenshotModeOpen, setScreenshotModeOpen] = useState(false);
  /**
   * When true, a capture (especially full-page) is in progress.
   */
  const [screenshotBusy, setScreenshotBusy] = useState(false);
  /**
   * Success/error notice shown between chrome and the guest (never behind WebContentsView).
   */
  const [screenshotNotice, setScreenshotNotice] = useState<ScreenshotNotice | null>(null);
  /**
   * When true, address autocomplete still owns a guest cover request (may be in-flight).
   */
  const wantAddressGuestCoverRef = useRef(false);

  /**
   * Merges collection/environment variables with this live page's variables for the address bar.
   */
  const resolvedVariables = useMemo(
    () => mergeLivePageVariables(variables, tab.variables),
    [variables, tab.variables]
  );

  /**
   * Freezes and hides the native guest before address suggestions paint (same as downloads menu).
   *
   * WebContentsView always composites above HTML, so the portaled list is only usable after the
   * guest is covered with a freeze frame.
   */
  const prepareAddressSuggestionsOverlay = useCallback(async (): Promise<void> => {
    wantAddressGuestCoverRef.current = true;
    await coverBrowserGuestForOverlay(tab.tabId, 'address-suggestions');
    if (!wantAddressGuestCoverRef.current) {
      void uncoverBrowserGuest('address-suggestions');
    }
  }, [tab.tabId]);

  /**
   * Restores the guest when address suggestions close.
   *
   * @param open - Whether address suggestions are open.
   */
  const handleAddressSuggestionsOpenChange = useCallback((open: boolean): void => {
    if (open) {
      wantAddressGuestCoverRef.current = true;
      return;
    }
    wantAddressGuestCoverRef.current = false;
    void uncoverBrowserGuest('address-suggestions');
  }, []);

  /**
   * Creates the guest once, shows it while this panel is mounted, and hides on leave.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Ensures the guest exists then makes it visible for this tab.
     */
    async function ensureGuest(): Promise<void> {
      if (!hasBrowserGuest(tab.tabId)) {
        await window.api.browserCreate(
          tab.tabId,
          tab.url,
          tab.homeUrl,
          tab.savedScripts,
          buildBrowserHcScriptsPayload(tab, snippets, variables, true)
        );
        if (cancelled) {
          return;
        }
        markBrowserGuestCreated(tab.tabId);
      }
      if (cancelled) {
        return;
      }
      // Do not re-show a guest that an HTML overlay (address autocomplete, menu) has covered.
      if (getBrowserGuestCover()?.tabId === tab.tabId) {
        return;
      }
      await window.api.browserSetVisible(tab.tabId, true);
    }

    void ensureGuest();

    return () => {
      cancelled = true;
      wantAddressGuestCoverRef.current = false;
      dismissBrowserGuestCover(tab.tabId);
      void window.api.browserSetVisible(tab.tabId, false);
    };
    // Intentionally only re-run when the tab identity changes; URL/scripts sync via chrome actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount lifecycle for one tab id
  }, [tab.tabId]);

  /**
   * Re-pushes saved live-page scripts/variables when the active collection/environment map or
   * saved website variables change so hc.request.variables stays in sync without remounting.
   */
  useEffect(() => {
    if (!hasBrowserGuest(tab.tabId)) {
      return;
    }
    void window.api
      .browserSetScripts(
        tab.tabId,
        tab.savedScripts,
        buildBrowserHcScriptsPayload(tab, snippets, variables, true)
      )
      .catch(() => {
        // Guest may have been destroyed between the check and the IPC call.
      });
    // Draft live-page variables intentionally omitted — unsaved drafts apply after Save.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on saved baselines + active vars
  }, [
    tab.tabId,
    tab.websiteUuid,
    tab.savedVariables,
    tab.savedScripts,
    tab.savedPreRequestScripts,
    tab.savedPostRequestScripts,
    tab.savedHeaders,
    tab.savedAuth,
    tab.savedUserAgent,
    variables,
    snippets
  ]);

  /**
   * Freezes and hides the native WebContentsView while the screenshot mode modal is
   * open so the HTML dialog is not covered by the guest layer, and so the host does
   * not flash empty grey behind the dialog.
   */
  useEffect(() => {
    if (!screenshotModeOpen) {
      return;
    }
    let cancelled = false;

    /**
     * Applies the freeze-frame cover once the effect is still current.
     */
    async function cover(): Promise<void> {
      await coverBrowserGuestForOverlay(tab.tabId, 'screenshot-mode');
      if (cancelled) {
        await uncoverBrowserGuest('screenshot-mode');
      }
    }

    void cover();
    return () => {
      cancelled = true;
      void uncoverBrowserGuest('screenshot-mode');
    };
  }, [screenshotModeOpen, tab.tabId]);

  /**
   * Clears screenshot notices after a short delay so the banner does not linger.
   */
  useEffect(() => {
    if (!screenshotNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setScreenshotNotice(null);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [screenshotNotice]);

  /**
   * Navigates the guest to an allowed URL.
   *
   * @param url - Absolute URL already validated by the address bar.
   */
  function handleNavigate(url: string): void {
    void window.api.browserLoadURL(tab.tabId, url);
  }

  /**
   * Opens the screenshot mode chooser when a capture is not already running.
   */
  function handleScreenshotClick(): void {
    if (screenshotBusy) {
      return;
    }
    setScreenshotModeOpen(true);
  }

  /**
   * Opens the AI sidebar and inserts an `@webpage.<tabId>` pointer for this browser tab.
   */
  function handleAskAi(): void {
    void copyToChat(`@webpage.${tab.tabId}`);
  }

  /**
   * Captures the guest (viewport or full page) and prompts the user to save a PNG.
   *
   * Releases the screenshot-mode freeze cover and restores guest visibility before
   * capture so the page is painted (the modal close effect alone may not have
   * flushed yet when this runs).
   *
   * @param fullPage - When true, scroll-and-stitch the full document.
   */
  async function handleScreenshotCapture(fullPage: boolean): Promise<void> {
    setScreenshotModeOpen(false);
    setScreenshotNotice(null);
    setScreenshotBusy(true);
    try {
      await uncoverBrowserGuest('screenshot-mode');
      await window.api.browserSetVisible(tab.tabId, true);
      const { dataUrl, truncated } = await window.api.browserCapturePage(tab.tabId, { fullPage });
      const result = await window.api.saveDataUrlToFile({
        dataUrl,
        defaultFileName: browserScreenshotDefaultFileName(tab.title)
      });
      if (!result.canceled && result.path) {
        void window.api.browserRecordDownload(result.path);
        setScreenshotNotice({
          tone: 'success',
          message: truncated
            ? 'Screenshot saved (page taller than the capture limit; captured the top portion)'
            : 'Screenshot saved'
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setScreenshotNotice({ tone: 'error', message });
    } finally {
      setScreenshotBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <BrowserChrome
        tab={tab}
        variables={resolvedVariables}
        onNavigate={handleNavigate}
        onBack={() => void window.api.browserGoBack(tab.tabId)}
        onForward={() => void window.api.browserGoForward(tab.tabId)}
        onReload={() => void window.api.browserReload(tab.tabId)}
        onHome={() => void window.api.browserGoHome(tab.tabId)}
        onScreenshot={handleScreenshotClick}
        screenshotDisabled={screenshotBusy}
        onAskAi={aiAvailable ? handleAskAi : undefined}
        onEditVariables={onEditVariables}
        beforeSuggestionsOpen={prepareAddressSuggestionsOverlay}
        onSuggestionsOpenChange={handleAddressSuggestionsOpenChange}
      />
      {screenshotBusy ? (
        <p
          className="border-b border-separator bg-control px-3 py-2 text-[14px] text-muted"
          role="status"
          aria-live="polite"
        >
          Taking screenshot…
        </p>
      ) : null}
      {screenshotNotice ? (
        <p
          className={
            screenshotNotice.tone === 'error'
              ? 'border-b border-separator bg-control px-3 py-2 text-[14px] text-danger'
              : 'border-b border-separator bg-control px-3 py-2 text-[14px] text-success'
          }
          role="status"
          aria-live="polite"
        >
          {screenshotNotice.message}
        </p>
      ) : null}
      {screenshotModeOpen ? (
        <BrowserScreenshotModeModal
          onClose={() => setScreenshotModeOpen(false)}
          onChoose={(fullPage) => void handleScreenshotCapture(fullPage)}
        />
      ) : null}
      <div ref={hostRef} className="relative min-h-0 flex-1">
        <BrowserGuestBoundsSync tabId={tab.tabId} hostRef={hostRef} />
        <div className="min-h-0 h-full flex-1 bg-control" aria-hidden />
        <BrowserGuestCoverImage tabId={tab.tabId} />
      </div>
    </div>
  );
}
