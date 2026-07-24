import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { GettingStartedPage } from '#/renderer/src/ui/GettingStarted/GettingStartedPage';

/**
 * Route wrapper for the Getting Started page tab.
 *
 * @param _props - Page tab props (unused; the page has no page-specific state).
 * @returns Getting Started page content.
 */
export function GettingStartedPageRoute(
  _props: PageComponentProps<'getting-started'>
): JSX.Element {
  void _props;
  return <GettingStartedPage />;
}
