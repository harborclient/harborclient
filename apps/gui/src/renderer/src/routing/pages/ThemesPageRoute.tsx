import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { Plugins } from '#/renderer/src/ui/Tabs/Plugins';

/**
 * Route wrapper for the Themes marketplace page tab.
 *
 * @param props - Page tab props including hosting tab id.
 * @returns Themes page content.
 */
export function ThemesPageRoute({ tabId }: PageComponentProps<'themes'>): JSX.Element {
  return <Plugins kind="themes" tabId={tabId} />;
}
