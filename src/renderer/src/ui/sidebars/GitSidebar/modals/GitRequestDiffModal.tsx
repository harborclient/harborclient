import { Modal } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { GitRequestDiffResult, SavedRequest } from '#/shared/types';
import { GitDiffFileView } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitDiffFileView';

interface Props {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * Git connection id for diff lookup.
   */
  connectionId: string;

  /**
   * Stable collection uuid for diff lookup.
   */
  collectionUuid: string;

  /**
   * Request whose working-tree diff is shown.
   */
  request: SavedRequest;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;
}

/**
 * Shows a HEAD-versus-working-tree diff for one changed request.
 */
export function GitRequestDiffModal({
  open,
  connectionId,
  collectionUuid,
  request,
  onClose
}: Props): JSX.Element | null {
  const [diff, setDiff] = useState<GitRequestDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');

  /**
   * Stable key for the currently requested diff payload.
   */
  const requestKey = useMemo(
    () => `${connectionId}:${collectionUuid}:${request.uuid}`,
    [collectionUuid, connectionId, request.uuid]
  );

  /**
   * Loads the request diff when the modal opens or the target request changes.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void window.api
      .gitRequestDiff({
        connectionId,
        collectionUuid,
        requestUuid: request.uuid
      })
      .then((result) => {
        if (!cancelled) {
          setDiff(result);
          setError(null);
          setLoadedKey(requestKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDiff(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoadedKey(requestKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, connectionId, collectionUuid, request.uuid, requestKey]);

  if (!open) {
    return null;
  }

  const loading = loadedKey !== requestKey;

  return (
    <Modal
      onClose={onClose}
      className="flex w-[80vw] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
      labelledBy="git-request-diff-title"
      title={`Changes — ${request.name}`}
    >
      {error != null ? (
        <p className="text-danger" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="text-muted" role="status">
          Loading diff…
        </p>
      ) : diff == null ? (
        <p className="text-muted" role="status">
          No diff available for this request.
        </p>
      ) : diff.error != null ? (
        <p className="text-danger" role="alert">
          {diff.error}
        </p>
      ) : diff.files.length === 0 ? (
        <p className="text-muted" role="status">
          No diff available for this request.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {diff.files.map((file) => (
            <GitDiffFileView key={file.path} file={file} />
          ))}
        </div>
      )}
    </Modal>
  );
}
