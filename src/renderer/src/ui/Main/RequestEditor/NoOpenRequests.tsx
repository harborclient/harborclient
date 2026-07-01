import type { JSX } from 'react';
import { Button, EmptyState, FaIcon } from '@harborclient/sdk/components';
import { faGlobe } from '#/renderer/src/fontawesome';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { newTab } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Empty workspace shown when every request tab has been closed.
 */
export function NoOpenRequests(): JSX.Element {
  const dispatch = useAppDispatch();

  /**
   * Opens a blank request tab from the empty workspace.
   */
  const handleNewRequest = (): void => {
    dispatch(newTab());
  };

  return (
    <div role="status" aria-label="No request open" className="flex min-h-0 flex-1 flex-col">
      <EmptyState variant="centered" className="h-full">
        <div className="flex flex-col items-center gap-3">
          <FaIcon icon={faGlobe} className="h-12 w-12" aria-hidden />
          <p className="m-0 text-[14px] text-muted">No request open</p>
          <Button type="button" onClick={handleNewRequest}>
            New request
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}
