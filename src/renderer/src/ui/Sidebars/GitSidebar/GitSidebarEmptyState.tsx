import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faCodeBranch } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Display name of the sidebar-selected collection, when one is selected.
   */
  selectedCollectionName?: string | null;
}

/**
 * Empty state shown when the Git sidebar has no git-backed collection to display.
 */
export function GitSidebarEmptyState({ selectedCollectionName }: Props): JSX.Element {
  const hasSelection = selectedCollectionName != null && selectedCollectionName.length > 0;
  const message = hasSelection
    ? `"${selectedCollectionName}" is not stored in a git repository. Select a git-backed collection to use source control.`
    : 'Select a git-backed collection to view source control.';

  return (
    <div
      role="status"
      aria-label={hasSelection ? 'Selected collection is not git-backed' : 'No collection selected'}
      className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-muted"
    >
      <FaIcon icon={faCodeBranch} className="h-12 w-12" aria-hidden />
      <p className="m-0">{message}</p>
    </div>
  );
}
