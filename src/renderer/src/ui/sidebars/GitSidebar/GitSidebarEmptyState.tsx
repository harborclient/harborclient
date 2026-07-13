import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faGlobe } from '#/renderer/src/fontawesome';

/**
 * Empty state shown when no git-backed collection is selected for the Git sidebar.
 */
export function GitSidebarEmptyState(): JSX.Element {
  return (
    <div
      role="status"
      aria-label="No collection selected"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-muted"
    >
      <FaIcon icon={faGlobe} className="h-12 w-12" aria-hidden />
      <p className="m-0 text-[14px]">No collection selected</p>
    </div>
  );
}
