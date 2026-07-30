import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { Variable } from '@harborclient/core/types';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { saveOrUpdateBrowserWebsite } from '#/renderer/src/store/thunks/websites';
import { buildBrowserHcScriptsPayload } from '#/renderer/src/store/browser/browserGuestPayload';
import { BrowserChrome } from './BrowserChrome';
import { BrowserGuestBoundsSync } from './BrowserGuestBoundsSync';
import { BrowserScreenshotModeModal } from './BrowserScreenshotModeModal';
import { browserScreenshotDefaultFileName } from './browserScreenshotFileName';
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
  const dispatch = useAppDispatch();
  const snippets = useAppSelector(selectSnippets);
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
   * Merges collection/environment variables with this live page's variables for the address bar.
   */
  const resolvedVariables = useMemo(
    () => mergeLivePageVariables(variables, tab.variables),
    [variables, tab.variables]
  );

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
          buildBrowserHcScriptsPayload(tab, snippets, true)
        );
        if (cancelled) {
          return;
        }
        markBrowserGuestCreated(tab.tabId);
      }
      if (cancelled) {
        return;
      }
      await window.api.browserSetVisible(tab.tabId, true);
    }

    void ensureGuest();

    return () => {
      cancelled = true;
      void window.api.browserSetVisible(tab.tabId, false);
    };
    // Intentionally only re-run when the tab identity changes; URL/scripts sync via chrome actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount lifecycle for one tab id
  }, [tab.tabId]);

  /**
   * Hides the native WebContentsView while the screenshot mode modal is open so the
   * HTML dialog is not covered by the guest layer (same pattern as unsaved-close prompts).
   */
  useEffect(() => {
    if (!screenshotModeOpen) {
      return;
    }
    void window.api.browserSetVisible(tab.tabId, false);
    return () => {
      void window.api.browserSetVisible(tab.tabId, true);
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
   * Opens the per-tab live page settings page.
   */
  function handleOpenSettings(): void {
    dispatch(
      openPageTab({
        type: 'browser-settings',
        browserTabId: tab.tabId,
        label: 'Live Page Settings'
      })
    );
  }

  /**
   * Saves a new live page or updates the linked live page from this tab.
   */
  function handleSave(): void {
    void dispatch(saveOrUpdateBrowserWebsite(tab.tabId));
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
   * Captures the guest (viewport or full page) and prompts the user to save a PNG.
   *
   * Explicitly restores guest visibility before capture so the page is painted (the modal
   * hide effect alone may not have flushed yet when this runs).
   *
   * @param fullPage - When true, scroll-and-stitch the full document.
   */
  async function handleScreenshotCapture(fullPage: boolean): Promise<void> {
    setScreenshotModeOpen(false);
    setScreenshotNotice(null);
    setScreenshotBusy(true);
    try {
      await window.api.browserSetVisible(tab.tabId, true);
      const { dataUrl, truncated } = await window.api.browserCapturePage(tab.tabId, { fullPage });
      const result = await window.api.saveDataUrlToFile({
        dataUrl,
        defaultFileName: browserScreenshotDefaultFileName(tab.title)
      });
      if (!result.canceled) {
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
        onSave={handleSave}
        onScreenshot={handleScreenshotClick}
        screenshotDisabled={screenshotBusy}
        onOpenSettings={handleOpenSettings}
        onEditVariables={onEditVariables}
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
      </div>
    </div>
  );
}
