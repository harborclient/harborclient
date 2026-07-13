import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { CollectionDocument, SavedRequest, SourceControlStatus } from '#/shared/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useGitDocumentStatuses } from '#/renderer/src/hooks/useGitDocumentStatuses';
import { useGitRequestStatuses } from '#/renderer/src/hooks/useGitRequestStatuses';
import { buildGitChangesMenuGroups } from '#/renderer/src/git/buildGitChangesMenuGroups';
import { buildGitWorkingTreeSummary } from '#/renderer/src/git/gitWorkingTreeSummary';
import {
  buildGitRequestAccessibleName,
  gitRequestNameClass
} from '#/renderer/src/git/gitRequestDisplay';
import {
  METHOD_CLASSES,
  gitWorkingTreeStatusPanel,
  sourceRow
} from '#/renderer/src/ui/shared/classes';
import { RowActionsMenu } from '@harborclient/sdk/components';
import { SidebarColorDot } from '#/renderer/src/ui/sidebars/CollectionSidebar/SidebarColorDot';
import { GitDocumentDiffModal } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitDocumentDiffModal';
import { GitRequestDiffModal } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitRequestDiffModal';
import { useAppSelector } from '#/renderer/src/store/hooks';

interface Props {
  /**
   * Git connection id for staging and diff operations.
   */
  connectionId: string;

  /**
   * Stable collection uuid for request status lookups.
   */
  collectionUuid: string;

  /**
   * Current source-control status for the active git connection.
   */
  status: SourceControlStatus | null;

  /**
   * Saved requests in the active collection.
   */
  requests: SavedRequest[];

  /**
   * Markdown documents in the active collection.
   */
  documents: CollectionDocument[];

  /**
   * Called after git file operations to refresh status.
   */
  onRefresh: () => void;
}

/**
 * Lists changed requests and markdown documents in the Git sidebar with git status coloring.
 */
export function GitChangesSection({
  connectionId,
  collectionUuid,
  status,
  requests,
  documents,
  onRefresh
}: Props): JSX.Element {
  const confirm = useConfirm();
  const gitAutoAdd = useAppSelector((state) => state.settings.general.gitAutoAdd);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [diffRequest, setDiffRequest] = useState<SavedRequest | null>(null);
  const [diffDocument, setDiffDocument] = useState<CollectionDocument | null>(null);
  const { statuses: requestStatuses, refresh: refreshRequests } = useGitRequestStatuses(
    connectionId,
    collectionUuid,
    true
  );
  const { statuses: documentStatuses, refresh: refreshDocuments } = useGitDocumentStatuses(
    connectionId,
    collectionUuid,
    true
  );

  /**
   * Requests with a non-clean git display status, sorted by name.
   */
  const changedRequests = useMemo(() => {
    return requests
      .filter((request) => {
        const status = requestStatuses[request.uuid];
        return status != null && status.displayStatus !== 'clean';
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, requestStatuses]);

  /**
   * Documents with a non-clean git display status, sorted by name.
   */
  const changedDocuments = useMemo(() => {
    return documents
      .filter((document) => {
        const status = documentStatuses[document.uuid];
        return status != null && status.displayStatus !== 'clean';
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [documents, documentStatuses]);

  /**
   * Refreshes both request and document git status maps.
   */
  const refreshAll = (): void => {
    void refreshRequests();
    void refreshDocuments();
    onRefresh();
  };

  /**
   * Stages working-tree changes for one request.
   *
   * @param requestUuid - Stable request uuid.
   */
  const handleAddRequest = async (requestUuid: string): Promise<void> => {
    try {
      await window.api.gitAddRequest({ connectionId, collectionUuid, requestUuid });
      refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Unstages staged changes for one request.
   *
   * @param requestUuid - Stable request uuid.
   */
  const handleRemoveRequest = async (requestUuid: string): Promise<void> => {
    try {
      await window.api.gitRemoveRequest({ connectionId, collectionUuid, requestUuid });
      refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Discards working-tree changes for one request after confirmation.
   *
   * @param request - Saved request to revert.
   */
  const handleRevertRequest = async (request: SavedRequest): Promise<void> => {
    const confirmed = await confirm({
      title: 'Revert changes',
      message: `Discard uncommitted git changes for "${request.name}"? This cannot be undone.`,
      confirmLabel: 'Revert',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      await window.api.gitRevertRequest({
        connectionId,
        collectionUuid,
        requestUuid: request.uuid
      });
      refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Stages working-tree changes for one markdown document.
   *
   * @param documentUuid - Stable document uuid.
   */
  const handleAddDocument = async (documentUuid: string): Promise<void> => {
    try {
      await window.api.gitAddDocument({ connectionId, collectionUuid, documentUuid });
      refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Unstages staged changes for one markdown document.
   *
   * @param documentUuid - Stable document uuid.
   */
  const handleRemoveDocument = async (documentUuid: string): Promise<void> => {
    try {
      await window.api.gitRemoveDocument({ connectionId, collectionUuid, documentUuid });
      refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Discards working-tree changes for one markdown document after confirmation.
   *
   * @param document - Collection document to revert.
   */
  const handleRevertDocument = async (document: CollectionDocument): Promise<void> => {
    const confirmed = await confirm({
      title: 'Revert changes',
      message: `Discard uncommitted git changes for "${document.name}"? This cannot be undone.`,
      confirmLabel: 'Revert',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      await window.api.gitRevertDocument({
        connectionId,
        collectionUuid,
        documentUuid: document.uuid
      });
      refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (changedRequests.length === 0 && changedDocuments.length === 0) {
    return (
      <div className="flex flex-col gap-2 pb-2">
        {status != null ? (
          <div className={`${gitWorkingTreeStatusPanel} text-text`} role="status">
            <p className="m-0">
              Branch: <strong>{status.branch ?? 'unknown'}</strong>
            </p>
            <p className="m-0 text-[14px] text-muted">
              {buildGitWorkingTreeSummary(status, gitAutoAdd)}
            </p>
          </div>
        ) : null}
        <div className="px-2 text-[14px] text-muted">No changed files</div>
      </div>
    );
  }

  return (
    <>
      {status != null ? (
        <div className={`${gitWorkingTreeStatusPanel} text-text`} role="status">
          <p className="m-0">
            Branch: <strong>{status.branch ?? 'unknown'}</strong>
          </p>
          <p className="m-0 text-[14px] text-muted">
            {buildGitWorkingTreeSummary(status, gitAutoAdd)}
          </p>
          {status.conflictCount > 0 ? (
            <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[14px] text-text">
              Merge conflict markers were found in collection or environment JSON files. Resolve
              conflict markers, then reload or pull again.
            </p>
          ) : null}
        </div>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-0 p-0">
        {changedRequests.map((request) => {
          const gitStatus = requestStatuses[request.uuid];
          const menuId = `git-change-request-${request.id}`;
          return (
            <li key={`request-${request.id}`} className={sourceRow(false, true)}>
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
                aria-label={buildGitRequestAccessibleName(request.name, gitStatus?.displayStatus)}
                onClick={() => setDiffRequest(request)}
              >
                <span
                  className={`shrink-0 px-1 py-px ${METHOD_CLASSES[request.method.toLowerCase()] ?? 'text-info'}`}
                >
                  {request.method}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className={`truncate ${gitRequestNameClass(gitStatus?.displayStatus)}`}>
                    {request.name}
                  </span>
                  <SidebarColorDot color={request.color} label={`Color for ${request.name}`} />
                </span>
              </button>
              <div className="shrink-0">
                <RowActionsMenu
                  menuId={menuId}
                  openMenuId={openMenuId}
                  onOpenChange={setOpenMenuId}
                  groups={buildGitChangesMenuGroups(
                    gitStatus,
                    () => void handleAddRequest(request.uuid),
                    () => void handleRemoveRequest(request.uuid),
                    () => void handleRevertRequest(request)
                  )}
                />
              </div>
            </li>
          );
        })}
        {changedDocuments.map((document) => {
          const gitStatus = documentStatuses[document.uuid];
          const menuId = `git-change-document-${document.id}`;
          return (
            <li key={`document-${document.id}`} className={sourceRow(false, true)}>
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
                aria-label={buildGitRequestAccessibleName(document.name, gitStatus?.displayStatus)}
                onClick={() => setDiffDocument(document)}
              >
                <span className="shrink-0 px-1 py-px text-muted">MD</span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className={`truncate ${gitRequestNameClass(gitStatus?.displayStatus)}`}>
                    {document.name}
                  </span>
                  <SidebarColorDot color={document.color} label={`Color for ${document.name}`} />
                </span>
              </button>
              <div className="shrink-0">
                <RowActionsMenu
                  menuId={menuId}
                  openMenuId={openMenuId}
                  onOpenChange={setOpenMenuId}
                  groups={buildGitChangesMenuGroups(
                    gitStatus,
                    () => void handleAddDocument(document.uuid),
                    () => void handleRemoveDocument(document.uuid),
                    () => void handleRevertDocument(document)
                  )}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {diffRequest != null && (
        <GitRequestDiffModal
          open={true}
          connectionId={connectionId}
          collectionUuid={collectionUuid}
          request={diffRequest}
          onClose={() => setDiffRequest(null)}
        />
      )}

      {diffDocument != null && (
        <GitDocumentDiffModal
          open={true}
          connectionId={connectionId}
          collectionUuid={collectionUuid}
          document={diffDocument}
          onClose={() => setDiffDocument(null)}
        />
      )}
    </>
  );
}
