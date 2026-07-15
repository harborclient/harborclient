import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { Plugins } from '#/renderer/src/ui/Tabs/Plugins';

/**
 * Route wrapper for the Themes marketplace page tab.
 *
 * @param _props - Page tab props (unused).
 * @returns Themes page content.
 */
export function ThemesPageRoute(_props: PageComponentProps<'themes'>): JSX.Element {
  void _props;
  return <Plugins kind="themes" />;
}
