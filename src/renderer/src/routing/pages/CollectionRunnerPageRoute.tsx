import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { CollectionRunner } from '#/renderer/src/ui/Tabs/CollectionRunner';

/**
 * Route wrapper for the collection runner page tab.
 *
 * @param props - Page identity carrying the run target.
 * @returns Collection runner content.
 */
export function CollectionRunnerPageRoute({
  page
}: PageComponentProps<'collection-runner'>): JSX.Element {
  return <CollectionRunner page={page} />;
}
