import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { AdminResourceOption, TeamHub } from '#/shared/types';
import { Input } from '#/renderer/src/components/forms';
import { Button } from '#/renderer/src/components/Button';
import { Modal } from '#/renderer/src/components/Modal';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faAngleLeft } from '#/renderer/src/fontawesome';
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
        <Button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          onClick={onBack}
        >
          <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" aria-hidden />
          Back
        </Button>
      </PageHeader>

      {loading ? (
        <p className="text-[14px] text-muted">Loading…</p>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mb-0 text-[14px] text-danger">{error}</p>
          <Button type="button" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : collections.length === 0 ? (
        <p className="text-[14px] text-muted">No collections found.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {collections.map((collection) => (
            <li
              key={collection.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-separator px-3 py-2"
            >
              <div className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-text">
                  {collection.name}
                </span>
                <span className="block truncate text-[14px] text-muted">{collection.id}</span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
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
              </div>
            </li>
          ))}
        </ul>
      )}

      {actionError && !deletingCollection && (
        <p className="mt-3 text-[14px] text-danger">{actionError}</p>
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
          <label className="mb-4 block text-[14px] text-text" htmlFor="delete-collection-confirm">
            Type DELETE to confirm
          </label>
          <Input
            id="delete-collection-confirm"
            value={deleteConfirmText}
            disabled={deleting}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            autoComplete="off"
          />

          {actionError && <p className="mt-3 text-[14px] text-danger">{actionError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondaryDanger"
              disabled={deleting || deleteConfirmText !== 'DELETE'}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
