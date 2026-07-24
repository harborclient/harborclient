import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { HostedMainView } from '#/renderer/src/ui/HostedMainView';

/**
 * Route wrapper for a plugin-hosted main view page tab.
 *
 * @param props - Page identity and hosting tab id.
 * @returns Hosted plugin main view content.
 */
export function HostedMainViewPageRoute({
  page,
  tabId
}: PageComponentProps<'hosted-main-view'>): JSX.Element {
  const dispatch = useAppDispatch();

  /**
   * Closes this hosted view tab when the plugin dismisses it.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

  return <HostedMainView pluginId={page.pluginId} viewId={page.viewId} onClose={handleClose} />;
}
