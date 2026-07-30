import { useMemo, type JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectTabs } from '#/renderer/src/store/selectors';
import { isBrowserTab } from '#/renderer/src/store/tabs';
import { LivePageSettingsForm } from '#/renderer/src/ui/Tabs/LivePageSettings/LivePageSettingsForm';

/**
 * Live page settings page: collection-style segmented tabs for a browser tab.
 *
 * @param props - Page identity including the owning browser tab id and hosting tab id.
 * @returns Tabbed settings form, or a message when the browser tab is gone.
 */
export function BrowserSettingsPageRoute({
  page,
  tabId
}: PageComponentProps<'browser-settings'>): JSX.Element {
  const tabs = useAppSelector(selectTabs);
  const browserTab = useMemo(
    () => tabs.find((tab) => isBrowserTab(tab) && tab.tabId === page.browserTabId),
    [tabs, page.browserTabId]
  );

  if (!browserTab || !isBrowserTab(browserTab)) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-muted">
        This browser tab is no longer open.
      </div>
    );
  }

  return <LivePageSettingsForm key={browserTab.tabId} browserTab={browserTab} tabId={tabId} />;
}
