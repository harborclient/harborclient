import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type {
  CreateHubUserInput,
  HubUserRecord,
  TeamHub,
  TeamHubAdminResourceOptions,
  UpdateHubUserInput
} from '#/shared/types';
import {
  AsyncListState,
  BackButton,
  Badge,
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
import { faUsers } from '#/renderer/src/fontawesome';
import { useTeamHubUsers } from '#/renderer/src/hooks/useTeamHubUsers';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { TeamSecretDialog } from '#/renderer/src/ui/TeamHub/TeamSecretDialog';
import { TeamUserForm } from '#/renderer/src/ui/TeamHub/TeamUserForm';

const editFormId = 'team-user-edit-form';
const createFormId = 'team-user-create-form';

interface Props {
  /**
   * Admin team hub connection whose users are being managed.
   */
  hub: TeamHub;

  /**
   * Returns to the team hub list view.
   */
  onBack: () => void;
}

/**
 * Team Hub user administration view for operator tokens.
 */
export function TeamManageView({ hub, onBack }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { users, loading, error, reload } = useTeamHubUsers(hub.id);
  const [editingUser, setEditingUser] = useState<HubUserRecord | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<HubUserRecord | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resourceOptions, setResourceOptions] = useState<TeamHubAdminResourceOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  /**
   * Loads autocomplete options for the selected hub.
   */
  const loadResourceOptions = (): void => {
    setResourceOptions(null);
    setOptionsLoading(true);

    void window.api
      .listTeamHubAdminResourceOptions(hub.id)
      .then((options) => {
        setResourceOptions(options);
      })
      .catch((error: unknown) => {
        setResourceOptions({ collections: [], environments: [], models: [] });
        const message = error instanceof Error ? error.message : 'Failed to load resource options.';
        setActionError(message);
      })
      .finally(() => {
        setOptionsLoading(false);
      });
  };

  /**
   * Closes the create modal and clears action errors.
   */
  const closeCreateModal = (): void => {
    if (saving) {
      return;
    }

    setCreatingUser(false);
    setResourceOptions(null);
    setOptionsLoading(false);
    setActionError(null);
  };

  /**
   * Opens the create user modal and loads resource options.
   */
  const handleCreateClick = (): void => {
    setActionError(null);
    setCreatingUser(true);
    loadResourceOptions();
  };

  /**
   * Closes the edit modal and clears action errors.
   */
  const closeEditModal = (): void => {
    if (saving) {
      return;
    }

    setEditingUser(null);
    setResourceOptions(null);
    setOptionsLoading(false);
    setActionError(null);
  };

  /**
   * Opens the edit modal for a user row.
   *
   * @param user - User account to edit.
   */
  const handleEdit = (user: HubUserRecord): void => {
    setActionError(null);
    setEditingUser(user);
    loadResourceOptions();
  };

  /**
   * Opens the delete confirmation modal for a user row.
   *
   * @param user - User account to delete.
   */
  const handleDeleteClick = (user: HubUserRecord): void => {
    setActionError(null);
    setDeleteConfirmText('');
    setDeletingUser(user);
  };

  /**
   * Closes the delete confirmation modal.
   */
  const closeDeleteModal = (): void => {
    if (deleting) {
      return;
    }

    setDeletingUser(null);
    setDeleteConfirmText('');
    setActionError(null);
  };

  /**
   * Persists user edits through the management API.
   *
   * @param input - Partial user fields to apply.
   */
  const handleSaveUser = async (input: UpdateHubUserInput): Promise<void> => {
    if (!editingUser) {
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      await window.api.updateTeamHubUser(hub.id, editingUser.id, input);
      setEditingUser(null);
      reload();
      await dispatch(refreshCollections());
      toast.success('User updated.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Creates a user account and shows the one-time token secret.
   *
   * @param input - User fields for the new account.
   */
  const handleCreateUser = async (input: CreateHubUserInput): Promise<void> => {
    setSaving(true);
    setActionError(null);

    try {
      const created = await window.api.createTeamHubUser(hub.id, input);
      setCreatingUser(false);
      setCreatedSecret(created.secret);
      reload();
      await dispatch(refreshCollections());
      toast.success('User created.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Deletes the selected user after the operator confirms by typing DELETE.
   */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletingUser || deleteConfirmText !== 'DELETE') {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      await window.api.deleteTeamHubUser(hub.id, deletingUser.id);
      setDeletingUser(null);
      setDeleteConfirmText('');
      reload();
      toast.success('User deleted.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Page
      embedded
      title="Users"
      icon={faUsers}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
      actions={
        <>
          <Button type="button" className="shrink-0 whitespace-nowrap" onClick={handleCreateClick}>
            Create user
          </Button>
          <BackButton onClick={onBack} />
        </>
      }
    >
      <AsyncListState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={users.length === 0}
        emptyMessage="No users found."
      >
        <ResourceList>
          {users.map((user) => (
            <ResourceListRow
              key={user.id}
              primary={
                <div className="flex min-w-0 items-center gap-2">
                  <ResourceListPrimary>{user.name || 'Untitled'}</ResourceListPrimary>
                  <Badge variant="success">{user.role}</Badge>
                </div>
              }
              secondary={user.id}
              actions={
                <>
                  <Button type="button" variant="secondary" onClick={() => handleEdit(user)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="primaryDanger"
                    onClick={() => handleDeleteClick(user)}
                  >
                    Delete
                  </Button>
                </>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {editingUser && (
        <Modal
          className="w-[520px]"
          labelledBy="team-user-dialog-title"
          onClose={closeEditModal}
          title="Edit user"
          description={
            <>Update account settings for &ldquo;{editingUser.name || 'Untitled'}&rdquo;.</>
          }
          closeDisabled={saving}
          disableEscape={saving}
        >
          <ModalFormLayout
            error={actionError ? <FieldError spacing="modal">{actionError}</FieldError> : null}
            actions={
              <Button type="submit" form={editFormId} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            }
          >
            <TeamUserForm
              key={editingUser.id}
              mode="edit"
              user={editingUser}
              disabled={saving}
              resourceOptions={resourceOptions}
              optionsLoading={optionsLoading}
              formId={editFormId}
              onSubmit={handleSaveUser}
            />
          </ModalFormLayout>
        </Modal>
      )}

      {creatingUser && (
        <Modal
          className="w-[520px]"
          labelledBy="team-user-create-title"
          onClose={closeCreateModal}
          title="Create user"
          description="A new API token will be generated automatically. Store the secret when it is shown; it will not be displayed again."
          closeDisabled={saving}
          disableEscape={saving}
        >
          <ModalFormLayout
            error={actionError ? <FieldError spacing="modal">{actionError}</FieldError> : null}
            actions={
              <Button type="submit" form={createFormId} disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </Button>
            }
          >
            <TeamUserForm
              key="create-user"
              mode="create"
              disabled={saving}
              resourceOptions={resourceOptions}
              optionsLoading={optionsLoading}
              formId={createFormId}
              onSubmit={handleCreateUser}
            />
          </ModalFormLayout>
        </Modal>
      )}

      {createdSecret && (
        <TeamSecretDialog
          title="User created"
          description="Copy this API token secret now. It will not be shown again."
          secret={createdSecret}
          onClose={() => setCreatedSecret(null)}
        />
      )}

      {deletingUser && (
        <Modal
          className="w-[480px]"
          labelledBy="team-user-delete-title"
          onClose={closeDeleteModal}
          title="Delete user?"
          description={
            <>
              This permanently deletes &ldquo;{deletingUser.name || 'Untitled'}&rdquo; and revokes
              all of their API tokens. Type <strong>DELETE</strong> to confirm.
            </>
          }
          closeDisabled={deleting}
          disableEscape={deleting}
        >
          <ModalFormLayout
            error={actionError ? <FieldError spacing="modal">{actionError}</FieldError> : null}
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
            <FormGroup label="Confirmation" htmlFor="team-user-delete-confirm">
              <Input
                id="team-user-delete-confirm"
                type="text"
                variant="surface"
                value={deleteConfirmText}
                disabled={deleting}
                autoComplete="off"
                onChange={(event) => setDeleteConfirmText(event.target.value)}
              />
            </FormGroup>
          </ModalFormLayout>
        </Modal>
      )}
    </Page>
  );
}
