import {
  AsyncListState,
  Button,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFormLayout,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { AdminResourceOption, TeamHub } from '#/shared/types';

import { faUsers } from '#/renderer/src/fontawesome';

import { useEscapeBackCapture } from '#/renderer/src/hooks/useEscapeBack';
import { useTeamHubAdminCollections } from '#/renderer/src/hooks/useTeamHubAdminCollections';
import { TeamCollectionContentsView } from '#/renderer/src/ui/TeamHub/TeamCollectionContentsView';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * Admin team hub connection whose collections are being managed.
   */
  hub: TeamHub;
}

/**
 * Team Hub collection administration view for operator tokens.
 */
export function TeamCollectionsView({ hub }: Props): JSX.Element {
  const { collections, loading, error, reload } = useTeamHubAdminCollections(hub.id);
  const [selectedCollection, setSelectedCollection] = useState<AdminResourceOption | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<AdminResourceOption | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Opens the delete confirmation modal for a collection row.
   *
   * @param collection - Collection record to delete.
   */
  const handleDeleteClick = (collection: AdminResourceOption): void => {
    setActionError(null);
    setDeleteConfirmText('');
    setDeletingCollection(collection);
  };

  /**
   * Closes the delete confirmation modal.
   */
  const closeDeleteModal = (): void => {
    if (deleting) {
      return;
    }

    setDeletingCollection(null);
    setDeleteConfirmText('');
    setActionError(null);
  };

  /**
   * Permanently deletes the selected collection on the hub after confirmation.
   */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletingCollection || deleteConfirmText !== 'DELETE') {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      await window.api.deleteTeamHubCollection(hub.id, deletingCollection.id);
      setDeletingCollection(null);
      setDeleteConfirmText('');
      reload();
      toast.success('Collection deleted.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Returns from collection contents to the collections list on Escape.
   */
  useEscapeBackCapture(() => {
    setSelectedCollection(null);
    reload();
  }, selectedCollection != null);

  if (selectedCollection) {
    return (
      <TeamCollectionContentsView
        hub={hub}
        collection={selectedCollection}
        onBack={() => {
          setSelectedCollection(null);
          reload();
        }}
        onCollectionUpdated={reload}
      />
    );
  }

  return (
    <Page
      embedded
      title="Collections"
      icon={faUsers}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
    >
      <AsyncListState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={collections.length === 0}
        emptyMessage="No collections found."
      >
        <ResourceList>
          {collections.map((collection) => (
            <ResourceListRow
              key={collection.id}
              wrap
              primary={<ResourceListPrimary>{collection.name}</ResourceListPrimary>}
              secondary={collection.id}
              actions={
                <>
                  <Button
                    type="button"
                    variant="toolbar"
                    onClick={() => setSelectedCollection(collection)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="toolbar"
                    className={toolbarDangerButtonClass}
                    onClick={() => handleDeleteClick(collection)}
                  >
                    Delete
                  </Button>
                </>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {actionError && !deletingCollection && (
        <FieldError spacing="section">{actionError}</FieldError>
      )}

      {deletingCollection && (
        <Modal
          labelledBy="delete-collection-title"
          onClose={closeDeleteModal}
          title="Delete collection?"
          description={
            <>
              Permanently delete &ldquo;{deletingCollection.name}&rdquo; from the team hub? Team
              members will lose access to this collection on the server.
            </>
          }
          closeDisabled={deleting}
          disableEscape={deleting}
        >
          <ModalFormLayout
            error={actionError ? <FieldError spacing="section">{actionError}</FieldError> : null}
            actions={
              <Button
                type="button"
                variant="primaryDanger"
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                onClick={() => void handleConfirmDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            }
          >
            <FormGroup
              label="Type DELETE to confirm"
              htmlFor="delete-collection-confirm"
              className="mb-4"
            >
              <Input
                id="delete-collection-confirm"
                value={deleteConfirmText}
                disabled={deleting}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                autoComplete="off"
              />
            </FormGroup>
          </ModalFormLayout>
        </Modal>
      )}
    </Page>
  );
}
