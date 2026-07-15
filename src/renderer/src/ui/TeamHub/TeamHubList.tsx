import {
  AsyncListState,
  Button,
  FaIcon,
  FieldError,
  Modal,
  ModalFooter,
  ModalFormLayout,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TeamHub, TeamHubServiceFlags } from '#/shared/types';

import { faPlus, faUsers } from '#/renderer/src/fontawesome';

import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';
import { createBlankTeamHub, validateTeamHubForm } from './constants';
import { TeamHubForm } from './TeamHubForm';
import { TeamHubServiceBadges } from './TeamHubServiceBadges';
import { TeamHubStatusDot } from './TeamHubStatusDot';

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
   * Opens team hub administration for an admin hub connection.
   */
  onManage: (hub: TeamHub) => void;
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
  onManage
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
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
      void dispatch(refreshHubLlmModels());
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
      void dispatch(refreshHubLlmModels());
      if (editingHub?.id === id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Page
        embedded
        title="Team Hub"
        icon={faUsers}
        description="Connect to HarborClient Team Hub instances for shared collections and environments."
        actions={
          <Button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            disabled={loading}
            onClick={handleAdd}
          >
            <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
            Add
          </Button>
        }
      >
        <AsyncListState
          loading={loading}
          error={bootstrapError}
          onRetry={reload}
          isEmpty={teamHubs.length === 0}
          emptyMessage="No team hubs configured yet."
        >
          <ResourceList className="flex flex-col gap-4">
            {teamHubs.map((hub) => (
              <ResourceListRow
                key={hub.id}
                primary={
                  <ResourceListPrimary>
                    <span className="flex items-center gap-1.5">
                      <TeamHubStatusDot
                        online={serviceFlagsByHubId.get(hub.id)?.storage ?? false}
                        scanning={scanning}
                      />
                      {hub.name || 'Untitled'}
                    </span>
                  </ResourceListPrimary>
                }
                secondary={hub.baseUrl}
                meta={
                  <TeamHubServiceBadges
                    services={
                      serviceFlagsByHubId.get(hub.id) ?? {
                        storage: false,
                        llm: false,
                        openai: false,
                        pluginCatalog: false,
                        snippets: false,
                        admin: false
                      }
                    }
                    scanning={scanning}
                  />
                }
                actions={
                  <>
                    {!scanning && adminHubIds.has(hub.id) && (
                      <Button type="button" variant="toolbar" onClick={() => onManage(hub)}>
                        Manage
                      </Button>
                    )}
                    <Button type="button" variant="toolbar" onClick={() => handleEdit(hub)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="toolbar"
                      className={toolbarDangerButtonClass}
                      onClick={() => setDeletingHub(hub)}
                    >
                      Delete
                    </Button>
                  </>
                }
              />
            ))}
          </ResourceList>
        </AsyncListState>

        {error && !editingHub && !deletingHub ? (
          <FieldError spacing="section">{error}</FieldError>
        ) : null}
      </Page>

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
          <ModalFormLayout
            error={error ? <FieldError spacing="modal">{error}</FieldError> : undefined}
            actions={
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            }
          >
            <TeamHubForm
              hub={editingHub}
              disabled={saving}
              fieldErrors={fieldErrors}
              onChange={setEditingHub}
            />
          </ModalFormLayout>
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
          <ModalFooter>
            <Button
              type="button"
              variant="primaryDanger"
              onClick={() => void handleDelete(deletingHub.id)}
            >
              Delete
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
