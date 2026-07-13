import { Modal } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { GitRequestDiffResult } from '#/shared/types';
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
   * Commit object id whose parent-to-commit diff is shown.
   */
  oid: string;

  /**
   * Stable collection uuid for diff lookup.
   */
  collectionUuid: string;

  /**
   * Stable request or document uuid.
   */
  resourceUuid: string;

  /**
   * Whether the resource is a request or markdown document.
   */
  kind: 'request' | 'document';

  /**
   * Display name shown in the modal title.
   */
  resourceName: string;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;
}

/**
 * Shows a parent-to-commit diff for one request or document in a historical commit.
 */
export function GitCommitResourceDiffModal({
  open,
  connectionId,
  oid,
  collectionUuid,
  resourceUuid,
  kind,
  resourceName,
  onClose
}: Props): JSX.Element | null {
  const [diff, setDiff] = useState<GitRequestDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');

  /**
   * Stable key for the currently requested commit resource diff payload.
   */
  const resourceKey = useMemo(
    () => `${connectionId}:${oid}:${collectionUuid}:${kind}:${resourceUuid}`,
    [collectionUuid, connectionId, kind, oid, resourceUuid]
  );

  /**
   * Loads the commit resource diff when the modal opens or the target resource changes.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void window.api
      .gitCommitResourceDiff({
        connectionId,
        oid,
        collectionUuid,
        resourceUuid,
        kind
      })
      .then((result) => {
        if (!cancelled) {
          setDiff(result);
          setError(null);
          setLoadedKey(resourceKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDiff(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoadedKey(resourceKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, connectionId, oid, collectionUuid, resourceUuid, kind, resourceKey]);

  if (!open) {
    return null;
  }

  const loading = loadedKey !== resourceKey;

  return (
    <Modal
      onClose={onClose}
      className="flex w-[80vw] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
      labelledBy="git-commit-resource-diff-title"
      title={`Changes — ${resourceName}`}
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
          No diff available for this resource.
        </p>
      ) : diff.error != null ? (
        <p className="text-danger" role="alert">
          {diff.error}
        </p>
      ) : diff.files.length === 0 ? (
        <p className="text-muted" role="status">
          No diff available for this resource.
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
