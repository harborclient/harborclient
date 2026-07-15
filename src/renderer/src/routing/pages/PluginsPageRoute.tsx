import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { Plugins } from '#/renderer/src/ui/Tabs/Plugins';

/**
 * Route wrapper for the Plugins marketplace page tab.
 *
 * @returns Plugins marketplace page content.
 */
export function PluginsPageRoute(_props: PageComponentProps<'plugins'>): JSX.Element {
  void _props;
  return <Plugins kind="plugins" />;
}
