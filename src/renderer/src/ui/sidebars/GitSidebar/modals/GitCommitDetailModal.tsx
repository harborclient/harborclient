import { Modal } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type {
  GitCommitDetail,
  GitCommitDocumentChange,
  GitCommitRequestChange
} from '#/shared/types';
import { buildGitCommitChangesViewModel } from '#/renderer/src/git/buildGitCommitChangesViewModel';
import {
  buildGitCommitResourceAccessibleName,
  gitCommitChangeNameClass
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
import { SidebarColorDot } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarColorDot';
import { GitCommitResourceDiffModal } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitCommitResourceDiffModal';

interface Props {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * Git connection id for commit detail lookup.
   */
  connectionId: string;

  /**
   * Commit object id to display.
   */
  oid: string;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;
}

/**
 * Selected request or document whose commit diff should open.
 */
type SelectedCommitResource =
  | {
      kind: 'request';
      change: GitCommitRequestChange;
    }
  | {
      kind: 'document';
      change: GitCommitDocumentChange;
    };

/**
 * Shows commit metadata and changed files for one git commit.
 */
export function GitCommitDetailModal({
  open,
  connectionId,
  oid,
  onClose
}: Props): JSX.Element | null {
  const [detail, setDetail] = useState<GitCommitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [selectedResource, setSelectedResource] = useState<SelectedCommitResource | null>(null);

  /**
   * Stable key for the currently requested commit detail payload.
   */
  const commitKey = useMemo(() => `${connectionId}:${oid}`, [connectionId, oid]);

  /**
   * Grouped request, document, and plain file rows for the loaded commit detail.
   */
  const changesViewModel = useMemo(() => {
    if (detail == null) {
      return null;
    }
    return buildGitCommitChangesViewModel(detail.files);
  }, [detail]);

  /**
   * Loads commit details when the modal opens or the target commit changes.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void window.api
      .gitCommitDetail(connectionId, oid)
      .then((result) => {
        if (!cancelled) {
          setSelectedResource(null);
          setDetail(result);
          setError(null);
          setLoadedKey(commitKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSelectedResource(null);
          setDetail(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoadedKey(commitKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, connectionId, oid, commitKey]);

  /**
   * Closes the modal and any open commit resource diff.
   */
  const handleClose = (): void => {
    setSelectedResource(null);
    onClose();
  };

  if (!open) {
    return null;
  }

  const loading = loadedKey !== commitKey;

  return (
    <>
      <Modal
        onClose={handleClose}
        className="w-[60rem]"
        labelledBy="git-commit-detail-title"
        title="Commit details"
      >
        {error != null ? (
          <p className="text-danger" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="text-muted" role="status">
            Loading commit details…
          </p>
        ) : detail == null ? (
          <p className="text-muted" role="status">
            Commit details unavailable.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="bg-control p-3 rounded-md">
              <p id="git-commit-detail-title" className="m-0 font-medium text-text">
                {detail.message}
              </p>
              <p className="m-0 text-[16px] text-muted">
                {detail.author} · {new Date(detail.timestamp).toLocaleString()}
              </p>
              <p className="m-0 break-all text-[16px] text-muted">{detail.oid}</p>
              {detail.fullMessage.trim() !== detail.message.trim() ? (
                <pre className="m-0 whitespace-pre-wrap rounded border border-separator bg-surface p-3 text-[14px] text-text">
                  {detail.fullMessage}
                </pre>
              ) : null}
            </div>

            <h3 className="m-0 text-[16px] font-medium text-text">Changed</h3>
            <div className="border border-separator border-md rounded-md p-3">
              {changesViewModel == null ||
              (changesViewModel.requests.length === 0 &&
                changesViewModel.documents.length === 0) ? (
                <p className="m-0 text-[16px] text-muted">No HarborClient requests changed</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-0 p-0">
                  {changesViewModel.requests.map((request) => (
                    <li key={`request-${request.requestUuid}`} className={sourceRow(false, true)}>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
                        aria-label={buildGitCommitResourceAccessibleName(
                          request.name,
                          request.status
                        )}
                        onClick={() => setSelectedResource({ kind: 'request', change: request })}
                      >
                        <span
                          className={`shrink-0 px-1 py-px ${METHOD_CLASSES[request.method.toLowerCase()] ?? 'text-info'}`}
                        >
                          {request.method}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <span className={`truncate ${gitCommitChangeNameClass(request.status)}`}>
                            {request.name}
                          </span>
                          <SidebarColorDot
                            color={request.color}
                            label={`Color for ${request.name}`}
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                  {changesViewModel.documents.map((document) => (
                    <li
                      key={`document-${document.documentUuid}`}
                      className={sourceRow(false, true)}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
                        aria-label={buildGitCommitResourceAccessibleName(
                          document.name,
                          document.status
                        )}
                        onClick={() => setSelectedResource({ kind: 'document', change: document })}
                      >
                        <span className="shrink-0 px-1 py-px text-muted">MD</span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <span className={`truncate ${gitCommitChangeNameClass(document.status)}`}>
                            {document.name}
                          </span>
                          <SidebarColorDot
                            color={document.color}
                            label={`Color for ${document.name}`}
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {selectedResource?.kind === 'request' ? (
        <GitCommitResourceDiffModal
          open={true}
          connectionId={connectionId}
          oid={oid}
          collectionUuid={selectedResource.change.collectionUuid}
          resourceUuid={selectedResource.change.requestUuid}
          kind="request"
          resourceName={selectedResource.change.name}
          onClose={() => setSelectedResource(null)}
        />
      ) : null}

      {selectedResource?.kind === 'document' ? (
        <GitCommitResourceDiffModal
          open={true}
          connectionId={connectionId}
          oid={oid}
          collectionUuid={selectedResource.change.collectionUuid}
          resourceUuid={selectedResource.change.documentUuid}
          kind="document"
          resourceName={selectedResource.change.name}
          onClose={() => setSelectedResource(null)}
        />
      ) : null}
    </>
  );
}
