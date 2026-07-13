import { Modal } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { CollectionDocument, GitRequestDiffResult } from '#/shared/types';
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
   * Document whose working-tree diff is shown.
   */
  document: CollectionDocument;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;
}

/**
 * Shows a HEAD-versus-working-tree diff for one changed markdown document.
 */
export function GitDocumentDiffModal({
  open,
  connectionId,
  collectionUuid,
  document,
  onClose
}: Props): JSX.Element | null {
  const [diff, setDiff] = useState<GitRequestDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');

  /**
   * Stable key for the currently requested diff payload.
   */
  const documentKey = useMemo(
    () => `${connectionId}:${collectionUuid}:${document.uuid}`,
    [collectionUuid, connectionId, document.uuid]
  );

  /**
   * Loads the document diff when the modal opens or the target document changes.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void window.api
      .gitDocumentDiff({
        connectionId,
        collectionUuid,
        documentUuid: document.uuid
      })
      .then((result) => {
        if (!cancelled) {
          setDiff(result);
          setError(null);
          setLoadedKey(documentKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDiff(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoadedKey(documentKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, connectionId, collectionUuid, document.uuid, documentKey]);

  if (!open) {
    return null;
  }

  const loading = loadedKey !== documentKey;

  return (
    <Modal
      onClose={onClose}
      className="flex w-[80vw] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
      labelledBy="git-document-diff-title"
      title={`Changes — ${document.name}`}
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
          No diff available for this document.
        </p>
      ) : diff.error != null ? (
        <p className="text-danger" role="alert">
          {diff.error}
        </p>
      ) : diff.files.length === 0 ? (
        <p className="text-muted" role="status">
          No diff available for this document.
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
