import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { LiveServerLogs } from '#/renderer/src/ui/Tabs/LiveServerLogs';

/**
 * Route wrapper for the live-server Express request logs page tab.
 *
 * @param props - Page identity carrying the saved live server id.
 * @returns Live server logs content.
 */
export function LiveServerLogsPageRoute({
  page
}: PageComponentProps<'live-server-logs'>): JSX.Element {
  return <LiveServerLogs page={page} />;
}
