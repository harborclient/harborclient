import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { Plugins } from '#/renderer/src/ui/Tabs/Plugins';

/**
 * Route wrapper for the Plugins marketplace page tab.
 *
 * @param props - Page tab props including hosting tab id.
 * @returns Plugins marketplace page content.
 */
export function PluginsPageRoute({ tabId }: PageComponentProps<'plugins'>): JSX.Element {
  return <Plugins kind="plugins" tabId={tabId} />;
}
