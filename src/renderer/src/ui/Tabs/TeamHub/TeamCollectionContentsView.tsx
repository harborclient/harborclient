import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type {
  AdminResourceOption,
  TeamHub,
  TeamHubAdminFolderSummary,
  TeamHubAdminRequestSummary
} from '#/shared/types';
import {
  AsyncListState,
  BackButton,
  Button,
  Checkbox,
  FieldError,
  FormGroup,
  Modal,
  ModalFooter,
  Page,
  ResourceList,
  ResourceListRow
} from '@harborclient/sdk/components';
import { faUsers } from '#/renderer/src/fontawesome';
import { useTeamHubAdminCollectionContents } from '#/renderer/src/hooks/useTeamHubAdminCollectionContents';
import { METHOD_CLASSES, toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';

interface Props {
  /**
   * Admin team hub connection whose collection is being inspected.
   */
  hub: TeamHub;

  /**
   * Collection whose folders and requests are listed.
   */
  collection: AdminResourceOption;

  /**
   * Returns to the collection list view.
   */
  onBack: () => void;

  /**
   * Notifies the parent to refresh collection metadata after a settings change.
   */
  onCollectionUpdated?: () => void;
}

/**
 * One folder section with its saved requests for the admin collection contents view.
 */
interface RequestSection {
  /**
   * Section heading shown above the request rows.
   */
  title: string;

  /**
   * Requests sorted for display within the section.
   */
  requests: TeamHubAdminRequestSummary[];
}

/**
 * Sorts folders by sort order, then name.
 *
 * @param folders - Folder summaries to order for display.
 * @returns Folders in sidebar order.
 */
function sortFolders(folders: TeamHubAdminFolderSummary[]): TeamHubAdminFolderSummary[] {
  return [...folders].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

/**
 * Sorts requests by sort order, then name.
 *
 * @param requests - Request summaries to order for display.
 * @returns Requests in sidebar order.
 */
function sortRequests(requests: TeamHubAdminRequestSummary[]): TeamHubAdminRequestSummary[] {
  return [...requests].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

/**
 * Groups saved requests under folder headings plus an unfiled root section.
 *
 * @param folders - Folder summaries in the collection.
 * @param requests - Request summaries in the collection.
 * @returns Ordered sections for rendering the request list.
 */
function buildRequestSections(
  folders: TeamHubAdminFolderSummary[],
  requests: TeamHubAdminRequestSummary[]
): RequestSection[] {
  const sections: RequestSection[] = [];
  const rootRequests = sortRequests(requests.filter((request) => request.folderId === null));

  if (rootRequests.length > 0) {
    sections.push({ title: 'Unfiled', requests: rootRequests });
  }

  for (const folder of sortFolders(folders)) {
    const folderRequests = sortRequests(
      requests.filter((request) => request.folderId === folder.id)
    );

    if (folderRequests.length > 0) {
      sections.push({ title: folder.name, requests: folderRequests });
    }
  }

  return sections;
}

/**
 * Team Hub collection contents view listing saved requests for operator inspection.
 */
export function TeamCollectionContentsView({
  hub,
  collection,
  onBack,
  onCollectionUpdated
}: Props): JSX.Element {
  const { folders, requests, loading, error, reload } = useTeamHubAdminCollectionContents(
    hub.id,
    collection.id
  );
  const [deletionLocked, setDeletionLocked] = useState(collection.deletionLocked);
  const [locking, setLocking] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<TeamHubAdminRequestSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Derives folder-grouped request sections for the current collection contents.
   */
  const sections = useMemo(() => buildRequestSections(folders, requests), [folders, requests]);

  /**
   * Updates whether non-admin users may delete this collection on the hub.
   *
   * @param nextDeletionLocked - New lock flag from the checkbox.
   */
  const handleDeletionLockedChange = async (nextDeletionLocked: boolean): Promise<void> => {
    setSettingsError(null);
    setLocking(true);

    try {
      await window.api.updateTeamHubCollectionDeletionLocked(
        hub.id,
        collection.id,
        nextDeletionLocked
      );
      setDeletionLocked(nextDeletionLocked);
      onCollectionUpdated?.();
      toast.success(
        nextDeletionLocked ? 'Collection protected from user deletion.' : 'Protection removed.'
      );
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLocking(false);
    }
  };

  /**
   * Closes the delete confirmation modal.
   */
  const closeDeleteModal = (): void => {
    if (deleting) {
      return;
    }

    setDeletingRequest(null);
    setActionError(null);
  };

  /**
   * Opens the delete confirmation modal for a request row.
   *
   * @param request - Saved request to delete.
   */
  const handleDeleteClick = (request: TeamHubAdminRequestSummary): void => {
    setActionError(null);
    setDeletingRequest(request);
  };

  /**
   * Permanently deletes the selected request on the hub after confirmation.
   */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletingRequest) {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      await window.api.deleteTeamHubRequest(hub.id, deletingRequest.id);
      setDeletingRequest(null);
      reload();
      toast.success('Request deleted.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Page
      embedded
      title={collection.name}
      icon={faUsers}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
      actions={<BackButton onClick={onBack} />}
    >
      <div className="mb-4 rounded-md border border-separator px-3 py-3">
        <FormGroup
          label="Protect from user deletion"
          htmlFor="collection-deletion-lock"
          layout="checkbox"
          className="cursor-pointer"
        >
          <Checkbox
            id="collection-deletion-lock"
            checked={deletionLocked}
            disabled={locking}
            onChange={(event) => void handleDeletionLockedChange(event.target.checked)}
          />
        </FormGroup>
        {settingsError ? (
          <FieldError spacing="field" className="mb-0 mt-2">
            {settingsError}
          </FieldError>
        ) : null}
      </div>

      <AsyncListState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={sections.length === 0}
        emptyMessage="No requests found."
      >
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="m-0 mb-2 text-[14px] font-medium text-text">{section.title}</h3>
              <ResourceList>
                {section.requests.map((request) => (
                  <ResourceListRow
                    key={request.id}
                    wrap
                    primary={
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className={`shrink-0 px-1 py-px text-[14px] font-medium ${METHOD_CLASSES[request.method.toLowerCase()] ?? 'text-info'}`}
                        >
                          {request.method}
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-text">
                            {request.name}
                          </span>
                          <span className="block truncate text-[14px] text-muted">
                            {request.url}
                          </span>
                          <span className="block truncate text-[14px] text-muted">
                            {request.id}
                          </span>
                        </div>
                      </div>
                    }
                    actions={
                      <Button
                        type="button"
                        variant="toolbar"
                        className={toolbarDangerButtonClass}
                        onClick={() => handleDeleteClick(request)}
                      >
                        Delete
                      </Button>
                    }
                  />
                ))}
              </ResourceList>
            </section>
          ))}
        </div>
      </AsyncListState>

      {deletingRequest && (
        <Modal
          onClose={closeDeleteModal}
          labelledBy="delete-request-title"
          title="Delete request?"
          description={
            <>
              Permanently delete &ldquo;{deletingRequest.name}&rdquo; from the team hub? Team
              members will lose access to this saved request on the server.
            </>
          }
          closeDisabled={deleting}
          disableEscape={deleting}
        >
          {actionError ? (
            <FieldError spacing="modal" className="mb-4 mt-0">
              {actionError}
            </FieldError>
          ) : null}
          <ModalFooter>
            <Button
              type="button"
              variant="primaryDanger"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </Page>
  );
}
