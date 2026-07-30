import { useEffect, useRef, type JSX } from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { saveOrUpdateBrowserWebsite } from '#/renderer/src/store/thunks/websites';
import { resolveBrowserHcScriptSources } from '#/browser/browserHcScripts';
import { buildScriptModuleMap } from '#/renderer/src/scripting/scriptResolution';
import { BrowserChrome } from './BrowserChrome';
import { BrowserGuestBoundsSync } from './BrowserGuestBoundsSync';
import { hasBrowserGuest, markBrowserGuestCreated } from './browserGuestRegistry';

interface Props {
  /**
   * Browser tab rendered in the editor panel.
   */
  tab: BrowserTab;
}

/**
 * Embedded browser tab: chrome controls plus a placeholder for the WebContentsView guest.
 *
 * Creates the main-process guest on first mount, shows it while active, and hides it on
 * unmount without destroying so inactive browser tabs keep their session.
 *
 * @param props - Browser tab state from Redux.
 * @returns Browser chrome and guest host.
 */
export function BrowserTabContent({ tab }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const snippets = useAppSelector(selectSnippets);
  const hostRef = useRef<HTMLDivElement>(null);

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
        const { modules, conflicts } = buildScriptModuleMap(snippets, [
          tab.savedPreRequestScripts,
          tab.savedPostRequestScripts
        ]);
        await window.api.browserCreate(tab.tabId, tab.url, tab.homeUrl, tab.savedScripts, {
          preRequestScripts: resolveBrowserHcScriptSources(tab.savedPreRequestScripts, snippets),
          postRequestScripts: resolveBrowserHcScriptSources(tab.savedPostRequestScripts, snippets),
          snippetModules: modules,
          snippetModuleConflicts: conflicts
        });
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
   * Navigates the guest to an allowed URL.
   *
   * @param url - Absolute URL already validated by the address bar.
   */
  function handleNavigate(url: string): void {
    void window.api.browserLoadURL(tab.tabId, url);
  }

  /**
   * Opens the per-tab browser settings page.
   */
  function handleOpenSettings(): void {
    dispatch(
      openPageTab({
        type: 'browser-settings',
        browserTabId: tab.tabId,
        label: 'Browser Settings'
      })
    );
  }

  /**
   * Saves a new website or updates the linked website from this tab.
   */
  function handleSave(): void {
    void dispatch(saveOrUpdateBrowserWebsite(tab.tabId));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <BrowserChrome
        tab={tab}
        onNavigate={handleNavigate}
        onBack={() => void window.api.browserGoBack(tab.tabId)}
        onForward={() => void window.api.browserGoForward(tab.tabId)}
        onReload={() => void window.api.browserReload(tab.tabId)}
        onHome={() => void window.api.browserGoHome(tab.tabId)}
        onSave={handleSave}
        onOpenSettings={handleOpenSettings}
      />
      <div ref={hostRef} className="relative min-h-0 flex-1">
        <BrowserGuestBoundsSync tabId={tab.tabId} hostRef={hostRef} />
        <div className="min-h-0 h-full flex-1 bg-control" aria-hidden />
      </div>
    </div>
  );
}
