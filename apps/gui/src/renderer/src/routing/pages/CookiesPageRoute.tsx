import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { Cookies } from '#/renderer/src/ui/Tabs/Cookies';

/**
 * Route wrapper for the Cookies page tab.
 *
 * @param _props - Page tab props (unused).
 * @returns Cookies page content.
 */
export function CookiesPageRoute(_props: PageComponentProps<'cookies'>): JSX.Element {
  void _props;
  return <Cookies />;
}
