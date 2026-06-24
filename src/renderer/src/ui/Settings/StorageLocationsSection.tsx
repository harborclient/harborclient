import { useEffect, useState, type JSX } from 'react';
import type { StorageConnection } from '#/shared/types';
import { useStorageConnections } from '#/renderer/src/hooks/useStorageConnections';
import { Button } from '#/renderer/src/components/Button';
import { createBlankConnection, providerLabel } from './constants';
import { StorageConnectionForm } from './StorageConnectionForm';

/**
 * Database settings with a list of named connections.
 */
export function StorageLocationsSection(): JSX.Element {
  const {
    connections,
    primaryConnectionId: activeId,
    loading,
    error: bootstrapError,
    reload: reloadConnections
  } = useStorageConnections();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingConnection, setEditingConnection] = useState<StorageConnection | null>(null);
  const [deletingConnection, setDeletingConnection] = useState<StorageConnection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSaved(false);
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
    setSaved(false);
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
   * Persists the connection being edited.
   */
  const handleSave = async (): Promise<void> => {
    if (!editingConnection) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const payload: StorageConnection = isNew
        ? { ...editingConnection, id: crypto.randomUUID() }
        : editingConnection;
      await window.api.saveStorageConnection(payload);
      reloadConnections();
      setEditingConnection(null);
      setIsNew(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Deletes a connection by id.
   *
   * @param id - Connection id to delete.
   */
  const handleDelete = async (id: string): Promise<void> => {
    setError(null);
    setSaved(false);
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
    setSaved(false);

    try {
      await window.api.setActiveStorageId(id);
      reloadConnections();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const sqliteCount = connections.filter((connection) => connection.type === 'sqlite').length;

  return (
    <>
      <div>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 mb-1 text-[14px] font-medium text-text">Storage Locations</h2>
            <p className="m-0 text-[14px] text-muted">
              Choose where HarborClient stores collections and imports. The active storage location
              is used for new collections and imports.
            </p>
          </div>
          <Button
            type="button"
            className="shrink-0 whitespace-nowrap"
            disabled={loading}
            onClick={handleAdd}
          >
            Add storage location
          </Button>
        </div>

        {loading ? (
          <p className="text-[14px] text-muted">Loading…</p>
        ) : bootstrapError ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="mb-0 text-[14px] text-danger">{bootstrapError}</p>
            <Button type="button" variant="secondary" onClick={reloadConnections}>
              Retry
            </Button>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {connections.map((connection) => {
              const isActive = connection.id === activeId;
              const isLastSqlite = connection.type === 'sqlite' && sqliteCount <= 1;
              const cannotDelete = connections.length <= 1 || isLastSqlite;

              return (
                <li
                  key={connection.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-separator px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-text">
                        {connection.name || 'Untitled'}
                      </span>
                      {isActive && (
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[14px] font-medium text-success">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[14px] text-muted">{providerLabel(connection.type)}</span>
                    {isLastSqlite && (
                      <p className="mb-0 mt-1 text-[14px] text-muted">
                        At least one SQLite connection must remain.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && !editingConnection && !deletingConnection && (
          <p className="mt-3 text-[14px] text-danger">{error}</p>
        )}
        {saved && <p className="mt-3 text-[14px] text-success">Settings saved.</p>}

        <p className="mb-0 mt-4 text-[14px] text-muted">
          Connection changes take effect after restarting HarborClient. All configured storage
          locations are opened at launch so shared collections are available immediately.
        </p>
      </div>

      {editingConnection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={handleCancelEdit}
        >
          <div
            className="max-h-[85vh] w-[480px] overflow-y-auto rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[14px] font-semibold text-text">
              {isNew ? 'Add storage location' : 'Edit storage location'}
            </h2>
            <p className="mb-4 text-[14px] text-muted">
              Choose a name and configure connection settings for this storage location.
            </p>

            <StorageConnectionForm
              connection={editingConnection}
              isNew={isNew}
              disabled={saving}
              onChange={setEditingConnection}
            />

            {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deletingConnection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeletingConnection(null)}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[14px] font-semibold text-text">
              Delete storage location?
            </h2>
            <p className="mb-2 text-[14px] text-muted">
              Are you sure you want to delete &ldquo;
              {deletingConnection.name || 'Untitled'}&rdquo;? This cannot be undone.
            </p>
            {deletingConnection.id === activeId && (
              <p className="mb-4 text-[14px] text-muted">
                This is the active storage location. Another location will become active after
                restart.
              </p>
            )}
            {deletingConnection.id !== activeId && <div className="mb-4" />}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeletingConnection(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondaryDanger"
                onClick={() => void handleDelete(deletingConnection.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
