import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing';
import { TeamHub } from '#/renderer/src/ui/Tabs/TeamHub';

/**
 * Route wrapper for the Team Hub list page tab.
 *
 * @param _props - Page tab props (unused).
 * @returns Team Hub page content.
 */
export function TeamHubsPageRoute(_props: PageComponentProps<'team-hubs'>): JSX.Element {
  return <TeamHub />;
}
