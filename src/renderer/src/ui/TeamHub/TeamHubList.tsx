import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TeamHub, TeamHubServiceFlags } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { Modal } from '#/renderer/src/components/Modal';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { formatIpcErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';
import { createBlankTeamHub, validateTeamHubForm } from './constants';
import { TeamHubForm } from './TeamHubForm';
import { TeamHubServiceBadges } from './TeamHubServiceBadges';
import { getReloadConfigAlertMessage } from './teamHubReloadHelpers';

interface Props {
  /**
   * Configured team hubs from settings.
   */
  teamHubs: TeamHub[];

  /**
   * True while the hub list is loading from IPC.
   */
  loading: boolean;

  /**
   * Bootstrap error from loading team hubs, if any.
   */
  bootstrapError: string | null;

  /**
   * Reloads the team hub list from IPC.
   */
  reload: () => void;

  /**
   * Hub ids whose tokens report management API capabilities.
   */
  adminHubIds: Set<string>;

  /**
   * Hub server service flags keyed by hub connection id.
   */
  serviceFlagsByHubId: Map<string, TeamHubServiceFlags>;

  /**
   * True while admin capability scanning is in flight.
   */
  scanning: boolean;

  /**
   * Re-runs the hub service scan after config reload.
   */
  onRescanServices: () => void;

  /**
   * Opens user management for an admin hub connection.
   */
  onManageUsers: (hub: TeamHub) => void;

  /**
   * Opens token management for an admin hub connection.
   */
  onManageTokens: (hub: TeamHub) => void;

  /**
   * Opens collection management for an admin hub connection.
   */
  onManageCollections: (hub: TeamHub) => void;

  /**
   * Closes the team hub overlay.
   */
  onClose: () => void;
}

/**
 * Lists configured team hubs with add, edit, and delete actions.
 */
export function TeamHubList({
  teamHubs,
  loading,
  bootstrapError,
  reload,
  adminHubIds,
  serviceFlagsByHubId,
  scanning,
  onRescanServices,
  onManageUsers,
  onManageTokens,
  onManageCollections,
  onClose
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [reloadingHubId, setReloadingHubId] = useState<string | null>(null);
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
    setError(null);
    setFieldErrors({});

    try {
      const payload: TeamHub = isNew ? { ...editingHub, id: crypto.randomUUID() } : editingHub;
      await window.api.saveTeamHub(payload);
      reload();
      await dispatch(refreshCollections());
      setEditingHub(null);
      setIsNew(false);
      toast.success('Team hub saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Reloads reloadable config sections on an admin-token hub connection.
   *
   * @param hub - Admin team hub connection to reload.
   */
  const handleReload = async (hub: TeamHub): Promise<void> => {
    setError(null);
    setReloadingHubId(hub.id);

    try {
      const result = await window.api.reloadTeamHubConfig(hub.id);
      const alertMessage = getReloadConfigAlertMessage(result);
      if (alertMessage) {
        showAlert(dispatch, alertMessage, 'Config reload failed', { icon: 'warning' });
        return;
      }

      toast.success('Config reloaded.');
      onRescanServices();
    } catch (err) {
      setError(formatIpcErrorMessage(err, 'Failed to reload team hub config.'));
    } finally {
      setReloadingHubId(null);
    }
  };

  /**
   * Deletes a team hub by id.
   *
   * @param id - Team hub id to delete.
   */
  const handleDelete = async (id: string): Promise<void> => {
    setError(null);
    setDeletingHub(null);

    try {
      await window.api.deleteTeamHub(id);
      reload();
      await dispatch(refreshCollections());
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
        <PageHeader
          title="Team Hub"
          description="Connect to HarborClient Team Hub instances for shared collections and environments."
        >
          <Button
            type="button"
            className="shrink-0 whitespace-nowrap"
            disabled={loading}
            onClick={handleAdd}
          >
            Add team hub
          </Button>
          <Button type="button" className="shrink-0 whitespace-nowrap" onClick={onClose}>
            Close
          </Button>
        </PageHeader>

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
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-text">
                      {hub.name || 'Untitled'}
                    </span>
                  </div>
                  <span className="truncate text-[14px] text-muted">{hub.baseUrl}</span>
                  <TeamHubServiceBadges
                    services={
                      serviceFlagsByHubId.get(hub.id) ?? {
                        storage: false,
                        llm: false,
                        pluginCatalog: false,
                        admin: false
                      }
                    }
                    scanning={scanning}
                  />
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {!scanning && adminHubIds.has(hub.id) && (
                    <>
                      <Button type="button" variant="secondary" onClick={() => onManageUsers(hub)}>
                        Manage users
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => onManageTokens(hub)}>
                        Manage tokens
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onManageCollections(hub)}
                      >
                        Manage collections
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={reloadingHubId === hub.id}
                        onClick={() => void handleReload(hub)}
                      >
                        {reloadingHubId === hub.id ? 'Reloading…' : 'Reload'}
                      </Button>
                    </>
                  )}
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
      </div>

      {editingHub && (
        <Modal
          className="w-[480px]"
          labelledBy="team-hub-dialog-title"
          onClose={handleCancelEdit}
          title={isNew ? 'Add team hub' : 'Edit team hub'}
          description="Enter a display name, team hub URL, and API token for HarborClient Team Hub."
          closeDisabled={saving}
          disableEscape={saving}
        >
          <TeamHubForm
            hub={editingHub}
            disabled={saving}
            fieldErrors={fieldErrors}
            onChange={setEditingHub}
          />

          {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Modal>
      )}

      {deletingHub && (
        <Modal
          labelledBy="delete-team-hub-title"
          onClose={() => setDeletingHub(null)}
          title="Delete team hub?"
          description={
            <>
              Are you sure you want to delete &ldquo;
              {deletingHub.name || 'Untitled'}&rdquo;? This cannot be undone.
            </>
          }
        >
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondaryDanger"
              onClick={() => void handleDelete(deletingHub.id)}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
