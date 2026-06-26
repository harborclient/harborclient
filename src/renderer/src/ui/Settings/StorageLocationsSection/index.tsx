import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { DiscoveredCollection, StorageConnection } from '#/shared/types';
import { useStorageConnections } from '#/renderer/src/hooks/useStorageConnections';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { Button } from '#/renderer/src/components/Button';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { Badge } from '#/renderer/src/components/Badge';
import { AsyncListState } from '#/renderer/src/components/AsyncListState';
import {
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '#/renderer/src/components/ResourceList';
import { FieldError } from '#/renderer/src/components/FieldError';
import { createBlankConnection, providerLabel, settingsSectionMeta } from '../constants';
import { SettingsCloseButton } from '../SettingsCloseButton';
import { DiscoverCollectionsModal } from './DiscoverCollectionsModal';
import { ConnectionDeleteModal } from './ConnectionDeleteModal';
import { ConnectionEditModal } from './ConnectionEditModal';

interface Props {
  /**
   * Closes the settings overlay.
   */
  onClose: () => void;
}

/**
 * Database settings with a list of named connections.
 */
export function StorageLocationsSection({ onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const {
    connections,
    primaryConnectionId: activeId,
    loading,
    error: bootstrapError,
    reload: reloadConnections
  } = useStorageConnections();
  const [saving, setSaving] = useState(false);
  const [editingConnection, setEditingConnection] = useState<StorageConnection | null>(null);
  const [deletingConnection, setDeletingConnection] = useState<StorageConnection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveryPrompt, setDiscoveryPrompt] = useState<{
    connectionId: string;
    connectionName: string;
    collections: DiscoveredCollection[];
  } | null>(null);

  /**
   * Closes edit or delete modals when Escape is pressed.
   */
  useEffect(() => {
    if (!editingConnection && !deletingConnection) return;

    /**
     * Dismisses the active modal on Escape.
     *
     * @param event - Window keydown event.
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (deletingConnection) {
        setDeletingConnection(null);
      } else {
        setEditingConnection(null);
        setIsNew(false);
        setError(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingConnection, deletingConnection]);

  /**
   * Opens the form to add a new connection.
   */
  const handleAdd = (): void => {
    setError(null);
    setIsNew(true);
    setEditingConnection(createBlankConnection('sqlite'));
  };

  /**
   * Opens the form to edit an existing connection.
   *
   * @param connection - Connection to edit.
   */
  const handleEdit = (connection: StorageConnection): void => {
    setError(null);
    setIsNew(false);
    setEditingConnection({ ...connection });
  };

  /**
   * Closes the connection editor modal.
   */
  const handleCancelEdit = (): void => {
    setEditingConnection(null);
    setIsNew(false);
    setError(null);
  };

  /**
   * Persists the connection being edited and prompts to import existing collections when new.
   */
  const handleSave = async (): Promise<void> => {
    if (!editingConnection) return;

    setSaving(true);
    setError(null);
    const savingNew = isNew;

    try {
      const payload: StorageConnection = isNew
        ? { ...editingConnection, id: crypto.randomUUID() }
        : editingConnection;
      await window.api.saveStorageConnection(payload);
      reloadConnections();
      setEditingConnection(null);
      setIsNew(false);

      if (savingNew) {
        try {
          const discovered = await window.api.listUnregisteredCollections(payload.id);
          if (discovered.length > 0) {
            setDiscoveryPrompt({
              connectionId: payload.id,
              connectionName: payload.name,
              collections: discovered
            });
            return;
          }
        } catch (discoverErr) {
          setError(
            discoverErr instanceof Error
              ? discoverErr.message
              : 'Could not scan for existing collections.'
          );
        }
      }

      toast.success('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Closes the collection discovery prompt after a successful action.
   */
  const closeDiscoveryPrompt = (): void => {
    setDiscoveryPrompt(null);
    setSaving(false);
    toast.success('Settings saved.');
  };

  /**
   * Registers selected discovered collections and refreshes the sidebar.
   *
   * @param providerCollectionIds - Provider-local collection ids to add.
   */
  const handleDiscoveryConfirm = async (providerCollectionIds: number[]): Promise<void> => {
    if (!discoveryPrompt) return;

    const result = await window.api.registerDiscoveredCollections(
      discoveryPrompt.connectionId,
      providerCollectionIds
    );
    await dispatch(refreshCollections());
    closeDiscoveryPrompt();

    if (result.added > 0) {
      toast.success(
        `Added ${result.added} collection${result.added === 1 ? '' : 's'} to the sidebar.`
      );
    }
  };

  /**
   * Records that the user skipped importing discovered collections.
   */
  const handleDiscoverySkip = async (): Promise<void> => {
    if (!discoveryPrompt) return;

    await window.api.markCollectionDiscoverySkipped(discoveryPrompt.connectionId);
    reloadConnections();
    closeDiscoveryPrompt();
  };

  /**
   * Deletes a connection by id.
   *
   * @param id - Connection id to delete.
   */
  const handleDelete = async (id: string): Promise<void> => {
    setError(null);
    setDeletingConnection(null);

    try {
      await window.api.deleteStorageConnection(id);
      reloadConnections();
      if (editingConnection?.id === id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Sets the active connection for the next app launch.
   *
   * @param id - Connection id to activate.
   */
  const handleSetActive = async (id: string): Promise<void> => {
    setError(null);

    try {
      await window.api.setActiveStorageId(id);
      reloadConnections();
      toast.success('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const sqliteCount = connections.filter((connection) => connection.type === 'sqlite').length;
  const { label, icon } = settingsSectionMeta('storage');

  return (
    <>
      <div>
        <PageHeader
          title={label}
          icon={icon}
          description="Choose where HarborClient stores collections and imports. The active storage location is used for new collections and imports."
        >
          <Button
            type="button"
            className="shrink-0 whitespace-nowrap"
            disabled={loading}
            onClick={handleAdd}
          >
            Add storage location
          </Button>
          <SettingsCloseButton onClose={onClose} />
        </PageHeader>

        <AsyncListState loading={loading} error={bootstrapError} onRetry={reloadConnections}>
          <ResourceList>
            {connections.map((connection) => {
              const isActive = connection.id === activeId;
              const isLastSqlite = connection.type === 'sqlite' && sqliteCount <= 1;
              const cannotDelete = connections.length <= 1 || isLastSqlite;

              return (
                <ResourceListRow
                  key={connection.id}
                  primary={
                    <div className="flex items-center gap-2">
                      <ResourceListPrimary>{connection.name || 'Untitled'}</ResourceListPrimary>
                      {isActive ? <Badge variant="success">Active</Badge> : null}
                    </div>
                  }
                  secondary={providerLabel(connection.type)}
                  meta={
                    isLastSqlite ? (
                      <p className="mb-0 mt-1 text-[14px] text-muted">
                        At least one SQLite connection must remain.
                      </p>
                    ) : undefined
                  }
                  actions={
                    <>
                      {!isActive && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void handleSetActive(connection.id)}
                        >
                          Set active
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleEdit(connection)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={cannotDelete}
                        onClick={() => setDeletingConnection(connection)}
                      >
                        Delete
                      </Button>
                    </>
                  }
                />
              );
            })}
          </ResourceList>
        </AsyncListState>

        {error && !editingConnection && !deletingConnection && (
          <FieldError spacing="section">{error}</FieldError>
        )}

        <p className="mb-0 mt-4 text-[14px] text-muted">
          Connection changes take effect after restarting HarborClient. All configured storage
          locations are opened at launch so shared collections are available immediately.
        </p>
      </div>

      {editingConnection && (
        <ConnectionEditModal
          connection={editingConnection}
          isNew={isNew}
          saving={saving}
          error={error}
          onChange={setEditingConnection}
          onCancel={handleCancelEdit}
          onSave={() => void handleSave()}
        />
      )}

      {discoveryPrompt && (
        <DiscoverCollectionsModal
          connectionName={discoveryPrompt.connectionName}
          collections={discoveryPrompt.collections}
          onConfirm={handleDiscoveryConfirm}
          onSkip={handleDiscoverySkip}
          onClose={() => void handleDiscoverySkip()}
        />
      )}

      {deletingConnection && (
        <ConnectionDeleteModal
          connection={deletingConnection}
          isActive={deletingConnection.id === activeId}
          onCancel={() => setDeletingConnection(null)}
          onConfirm={() => void handleDelete(deletingConnection.id)}
        />
      )}
    </>
  );
}
