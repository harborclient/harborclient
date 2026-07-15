import {
  AsyncListState,
  Button,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import type { AdminResourceOption, TeamHub } from '#/shared/types';

import { faUsers } from '#/renderer/src/fontawesome';

import { useEscapeBackCapture } from '#/renderer/src/hooks/useEscapeBack';
import { useTeamHubAdminCollections } from '#/renderer/src/hooks/useTeamHubAdminCollections';
import { useTypedDeleteConfirm } from '#/renderer/src/hooks/useTypedDeleteConfirm';
import { TeamCollectionContentsView } from '#/renderer/src/ui/TeamHub/TeamCollectionContentsView';
import { DeleteConfirmModal } from '#/renderer/src/ui/shared/DeleteConfirm/DeleteConfirmModal';
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
  const deleteCollection = useTypedDeleteConfirm<AdminResourceOption>({
    onDelete: (collection) => window.api.deleteTeamHubCollection(hub.id, collection.id),
    onSuccess: reload,
    successMessage: 'Collection deleted.'
  });

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
                    onClick={() => deleteCollection.open(collection)}
                  >
                    Delete
                  </Button>
                </>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {deleteCollection.target ? (
        <DeleteConfirmModal
          title="Delete collection?"
          description={
            <>
              Permanently delete &ldquo;{deleteCollection.target.name}&rdquo; from the team hub?
              Team members will lose access to this collection on the server.
            </>
          }
          busy={deleteCollection.busy}
          error={deleteCollection.error}
          onConfirm={() => void deleteCollection.confirm()}
          onClose={deleteCollection.close}
        />
      ) : null}
    </Page>
  );
}
