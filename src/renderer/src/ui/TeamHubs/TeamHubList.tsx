import { useEffect, useState, type JSX } from 'react';
import type { TeamHub } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { useTeamHubs } from '#/renderer/src/hooks/useTeamHubs';
import { createBlankTeamHub, validateTeamHubForm } from './constants';
import { TeamHubForm } from './TeamHubForm';

/**
 * Lists configured team hubs with add, edit, and delete actions.
 */
export function TeamHubList(): JSX.Element {
  const { teamHubs, loading, error: bootstrapError, reload } = useTeamHubs();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingHub, setEditingHub] = useState<TeamHub | null>(null);
  const [deletingHub, setDeletingHub] = useState<TeamHub | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Closes edit or delete modals when Escape is pressed.
   */
  useEffect(() => {
    if (!editingHub && !deletingHub) return;

    /**
     * Dismisses the active modal on Escape.
     *
     * @param event - Window keydown event.
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (deletingHub) {
        setDeletingHub(null);
      } else {
        setEditingHub(null);
        setIsNew(false);
        setError(null);
        setFieldErrors({});
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingHub, deletingHub]);

  /**
   * Opens the form to add a new team hub.
   */
  const handleAdd = (): void => {
    setError(null);
    setSaved(false);
    setFieldErrors({});
    setIsNew(true);
    setEditingHub(createBlankTeamHub());
  };

  /**
   * Opens the form to edit an existing team hub.
   *
   * @param hub - Team hub to edit.
   */
  const handleEdit = (hub: TeamHub): void => {
    setError(null);
    setSaved(false);
    setFieldErrors({});
    setIsNew(false);
    setEditingHub({ ...hub });
  };

  /**
   * Closes the team hub editor modal.
   */
  const handleCancelEdit = (): void => {
    setEditingHub(null);
    setIsNew(false);
    setError(null);
    setFieldErrors({});
  };

  /**
   * Persists the team hub being edited.
   */
  const handleSave = async (): Promise<void> => {
    if (!editingHub) return;

    const validationErrors = validateTeamHubForm(editingHub);
    if (validationErrors) {
      setFieldErrors(validationErrors);
      return;
    }

    setSaving(true);
    setSaved(false);
    setError(null);
    setFieldErrors({});

    try {
      const payload: TeamHub = isNew ? { ...editingHub, id: crypto.randomUUID() } : editingHub;
      await window.api.saveTeamHub(payload);
      reload();
      setEditingHub(null);
      setIsNew(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Deletes a team hub by id.
   *
   * @param id - Team hub id to delete.
   */
  const handleDelete = async (id: string): Promise<void> => {
    setError(null);
    setSaved(false);
    setDeletingHub(null);

    try {
      await window.api.deleteTeamHub(id);
      reload();
      if (editingHub?.id === id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 mb-1 text-[14px] font-medium text-text">Team hubs</h2>
            <p className="m-0 text-[14px] text-muted">
              Connect to HarborClient Team Hub instances for shared collections and environments.
            </p>
          </div>
          <Button
            type="button"
            className="shrink-0 whitespace-nowrap"
            disabled={loading}
            onClick={handleAdd}
          >
            Add team hub
          </Button>
        </div>

        {loading ? (
          <p className="text-[14px] text-muted">Loading…</p>
        ) : bootstrapError ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="mb-0 text-[14px] text-danger">{bootstrapError}</p>
            <Button type="button" variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : teamHubs.length === 0 ? (
          <p className="text-[14px] text-muted">No team hubs configured yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {teamHubs.map((hub) => (
              <li
                key={hub.id}
                className="flex items-center justify-between gap-3 rounded-md border border-separator px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-text">
                    {hub.name || 'Untitled'}
                  </div>
                  <span className="truncate text-[14px] text-muted">{hub.baseUrl}</span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => handleEdit(hub)}>
                    Edit
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setDeletingHub(hub)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && !editingHub && !deletingHub && (
          <p className="mt-3 text-[14px] text-danger">{error}</p>
        )}
        {saved && <p className="mt-3 text-[14px] text-success">Team hub saved.</p>}
      </div>

      {editingHub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={handleCancelEdit}
        >
          <div
            className="max-h-[85vh] w-[480px] overflow-y-auto rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-hub-dialog-title"
          >
            <h2 id="team-hub-dialog-title" className="m-0 mb-1 text-[14px] font-semibold text-text">
              {isNew ? 'Add team hub' : 'Edit team hub'}
            </h2>
            <p className="mb-4 text-[14px] text-muted">
              Enter a display name, team hub URL, and API token for HarborClient Team Hub.
            </p>

            <TeamHubForm
              hub={editingHub}
              disabled={saving}
              fieldErrors={fieldErrors}
              onChange={setEditingHub}
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

      {deletingHub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeletingHub(null)}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-team-hub-title"
          >
            <h2 id="delete-team-hub-title" className="m-0 mb-1 text-[14px] font-semibold text-text">
              Delete team hub?
            </h2>
            <p className="mb-4 text-[14px] text-muted">
              Are you sure you want to delete &ldquo;
              {deletingHub.name || 'Untitled'}&rdquo;? This cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeletingHub(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondaryDanger"
                onClick={() => void handleDelete(deletingHub.id)}
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
