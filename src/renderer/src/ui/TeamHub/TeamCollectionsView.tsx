import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { AdminResourceOption, TeamHub } from '#/shared/types';
import { Input } from '#/renderer/src/components/forms';
import { FormGroup } from '#/renderer/src/components/FormGroup';
import { Button } from '#/renderer/src/components/Button';
import { Modal, ModalFormLayout } from '#/renderer/src/components/Modal';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { BackButton } from '#/renderer/src/components/BackButton';
import { AsyncListState } from '#/renderer/src/components/AsyncListState';
import {
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '#/renderer/src/components/ResourceList';
import { FieldError } from '#/renderer/src/components/FieldError';
import { useTeamHubAdminCollections } from '#/renderer/src/hooks/useTeamHubAdminCollections';
import { TeamCollectionContentsView } from '#/renderer/src/ui/TeamHub/TeamCollectionContentsView';

interface Props {
  /**
   * Admin team hub connection whose collections are being managed.
   */
  hub: TeamHub;

  /**
   * Returns to the team hub list view.
   */
  onBack: () => void;
}

/**
 * Team Hub collection administration view for operator tokens.
 */
export function TeamCollectionsView({ hub, onBack }: Props): JSX.Element {
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
    <div>
      <PageHeader title="Collections" description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}>
        <BackButton onClick={onBack} />
      </PageHeader>

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
                    variant="secondary"
                    onClick={() => setSelectedCollection(collection)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondaryDanger"
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
                variant="secondaryDanger"
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
    </div>
  );
}
