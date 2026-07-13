import { useCallback, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { GitRequestFileStatus } from '#/shared/types';
import { useGitRequestStatuses } from '#/renderer/src/hooks/useGitRequestStatuses';

/**
 * Per-collection git request actions and status shared by request rows.
 */
export interface CollectionGitRequestContext {
  /**
   * Per-request git status keyed by request uuid.
   */
  statuses: Record<string, GitRequestFileStatus>;

  /**
   * Stages working-tree changes for one request.
   *
   * @param requestUuid - Stable request uuid.
   */
  stageRequest: (requestUuid: string) => Promise<void>;

  /**
   * Unstages staged changes for one request.
   *
   * @param requestUuid - Stable request uuid.
   */
  unstageRequest: (requestUuid: string) => Promise<void>;
}

interface Props {
  /**
   * Git connection id for the collection.
   */
  connectionId: string;

  /**
   * Stable collection uuid.
   */
  collectionUuid: string;

  /**
   * Renders collection contents with git request context.
   */
  children: (context: CollectionGitRequestContext) => ReactNode;
}

/**
 * Loads per-request git status for one git-backed collection and exposes stage/unstage actions.
 */
export function CollectionGitRequestProvider({
  connectionId,
  collectionUuid,
  children
}: Props): JSX.Element {
  const { statuses, refresh } = useGitRequestStatuses(connectionId, collectionUuid, true);

  /**
   * Stages working-tree changes for one request and refreshes sidebar status.
   *
   * @param requestUuid - Stable request uuid.
   */
  const stageRequest = useCallback(
    async (requestUuid: string): Promise<void> => {
      try {
        await window.api.gitAddRequest({ connectionId, collectionUuid, requestUuid });
        await refresh();
        toast.success('Request added to commit');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [collectionUuid, connectionId, refresh]
  );

  /**
   * Unstages staged changes for one request and refreshes sidebar status.
   *
   * @param requestUuid - Stable request uuid.
   */
  const unstageRequest = useCallback(
    async (requestUuid: string): Promise<void> => {
      try {
        await window.api.gitRemoveRequest({ connectionId, collectionUuid, requestUuid });
        await refresh();
        toast.success('Request removed from commit');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [collectionUuid, connectionId, refresh]
  );

  return <>{children({ statuses, stageRequest, unstageRequest })}</>;
}
