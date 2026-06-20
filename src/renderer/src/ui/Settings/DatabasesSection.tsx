import { useEffect, useState, type JSX } from 'react';
import type { DatabaseConnection } from '#/shared/types';
import { primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { createBlankConnection, providerLabel } from './constants';
import { DatabaseConnectionForm } from './DatabaseConnectionForm';

/**
 * Database settings with a list of named connections.
 */
export function DatabasesSection(): JSX.Element {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [deletingConnection, setDeletingConnection] = useState<DatabaseConnection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([window.api.listDatabaseConnections(), window.api.getActiveDatabaseId()]).then(
      ([nextConnections, nextActiveId]) => {
        if (cancelled) return;
        setConnections(nextConnections);
        setActiveId(nextActiveId);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editingConnection && !deletingConnection) return;

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
  const handleEdit = (connection: DatabaseConnection): void => {
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
      const payload: DatabaseConnection = isNew
        ? { ...editingConnection, id: crypto.randomUUID() }
        : editingConnection;
      const nextConnections = await window.api.saveDatabaseConnection(payload);
      setConnections(nextConnections);
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
      const nextConnections = await window.api.deleteDatabaseConnection(id);
      setConnections(nextConnections);
      const nextActiveId = await window.api.getActiveDatabaseId();
      setActiveId(nextActiveId);
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
      await window.api.setActiveDatabaseId(id);
      setActiveId(id);
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
            <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Databases</h2>
            <p className="m-0 text-[12px] text-muted">
              Define database connections. The active database is used for new collections and
              imports.
            </p>
          </div>
          <button
            type="button"
            className={`${primaryButton} shrink-0 whitespace-nowrap`}
            disabled={loading}
            onClick={handleAdd}
          >
            Add database
          </button>
        </div>

        {loading ? (
          <p className="text-[12px] text-muted">Loading…</p>
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
                      <span className="truncate text-[13px] font-medium text-text">
                        {connection.name || 'Untitled'}
                      </span>
                      {isActive && (
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-muted">{providerLabel(connection.type)}</span>
                    {isLastSqlite && (
                      <p className="mb-0 mt-1 text-[11px] text-muted">
                        At least one SQLite connection must remain.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!isActive && (
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => void handleSetActive(connection.id)}
                      >
                        Set active
                      </button>
                    )}
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => handleEdit(connection)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={cannotDelete}
                      onClick={() => setDeletingConnection(connection)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && !editingConnection && !deletingConnection && (
          <p className="mt-3 text-[12px] text-danger">{error}</p>
        )}
        {saved && <p className="mt-3 text-[12px] text-success">Settings saved.</p>}

        <p className="mb-0 mt-4 text-[12px] text-muted">
          Connection changes take effect after restarting HarborClient. All configured databases are
          opened at launch so shared collections are available immediately.
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
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">
              {isNew ? 'Add database' : 'Edit database'}
            </h2>
            <p className="mb-4 text-[12px] text-muted">
              Choose a name and configure connection settings for this database.
            </p>

            <DatabaseConnectionForm
              connection={editingConnection}
              isNew={isNew}
              disabled={saving}
              onChange={setEditingConnection}
            />

            {error && <p className="mt-4 text-[12px] text-danger">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={saving}
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButton}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
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
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">Delete database?</h2>
            <p className="mb-2 text-[12px] text-muted">
              Are you sure you want to delete &ldquo;
              {deletingConnection.name || 'Untitled'}&rdquo;? This cannot be undone.
            </p>
            {deletingConnection.id === activeId && (
              <p className="mb-4 text-[12px] text-muted">
                This is the active database. Another connection will become active after restart.
              </p>
            )}
            {deletingConnection.id !== activeId && <div className="mb-4" />}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setDeletingConnection(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${secondaryButton} text-danger hover:bg-danger/15`}
                onClick={() => void handleDelete(deletingConnection.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
