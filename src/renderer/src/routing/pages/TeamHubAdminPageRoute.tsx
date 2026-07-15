import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { TeamHubAdmin } from '#/renderer/src/ui/Tabs/TeamHub/TeamHubAdmin';

/**
 * Route wrapper for a Team Hub admin page tab.
 *
 * @param props - Page identity and hosting tab id.
 * @returns Team Hub admin page content.
 */
export function TeamHubAdminPageRoute({
  page,
  tabId
}: PageComponentProps<'team-hub-admin'>): JSX.Element {
  const dispatch = useAppDispatch();

  /**
   * Closes this admin tab when the page finishes or is dismissed.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

  return <TeamHubAdmin hubId={page.hubId} onClose={handleClose} />;
}
