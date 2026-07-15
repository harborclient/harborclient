import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { buildTeamHubJoinUrl, summarizeInvitationAccess } from '#/shared/deepLink';
import type {
  CreateHubUserInput,
  CreateInvitedHubUserInput,
  CreatedInvitedHubUser,
  HubUserRecord,
  TeamHub,
  TeamHubAdminResourceOptions,
  UpdateHubUserInput
} from '#/shared/types';
import {
  AsyncListState,
  Badge,
  Button,
  FieldError,
  Modal,
  ModalFormLayout,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { faUsers } from '#/renderer/src/fontawesome';
import { useTeamHubInvitations } from '#/renderer/src/hooks/useTeamHubInvitations';
import { useTeamHubUsers } from '#/renderer/src/hooks/useTeamHubUsers';
import { useTypedDeleteConfirm } from '#/renderer/src/hooks/useTypedDeleteConfirm';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { refreshCollections } from '#/renderer/src/store/thunks/collections';
import { TeamInvitationLinkDialog } from '#/renderer/src/ui/Tabs/TeamHub/TeamInvitationLinkDialog';
import { TeamSecretDialog } from '#/renderer/src/ui/Tabs/TeamHub/TeamSecretDialog';
import { TeamUserForm } from '#/renderer/src/ui/Tabs/TeamHub/TeamUserForm';
import { DeleteConfirmModal } from '#/renderer/src/ui/Shared/DeleteConfirm/DeleteConfirmModal';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';

const editFormId = 'team-user-edit-form';
const inviteFormId = 'team-user-invite-form';
const createFormId = 'team-user-create-form';

interface Props {
  /**
   * Admin team hub connection whose users are being managed.
   */
  hub: TeamHub;
}

/**
 * Maps invitation lifecycle status to badge variant styling.
 *
 * @param status - Derived invitation status from the server.
 */
function invitationBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (status === 'pending') {
    return 'warning';
  }
  if (status === 'redeemed') {
    return 'success';
  }
  if (status === 'revoked' || status === 'expired') {
    return 'danger';
  }
  return 'muted';
}

/**
 * Builds the HTTPS invite link shared with a newly created or reissued invitation.
 *
 * @param created - Invitation create response from the Team Hub admin API.
 * @param hub - Admin hub connection providing the public base URL and label.
 */
function buildInvitationLink(created: CreatedInvitedHubUser, hub: TeamHub): string {
  return buildTeamHubJoinUrl({
    baseUrl: hub.baseUrl,
    code: created.secret,
    name: created.user.name,
    role: created.user.role,
    expiresAt: created.invitation.expiresAt,
    hubName: hub.name,
    accessSummary: summarizeInvitationAccess(created.user)
  });
}

/**
 * Team Hub user administration view for operator tokens.
 */
export function TeamManageView({ hub }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { users, loading, error, reload } = useTeamHubUsers(hub.id);
  const {
    invitations,
    loading: invitationsLoading,
    error: invitationsError,
    reload: reloadInvitations
  } = useTeamHubInvitations(hub.id);
  const [editingUser, setEditingUser] = useState<HubUserRecord | null>(null);
  const [invitingUser, setInvitingUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const deleteUser = useTypedDeleteConfirm<HubUserRecord>({
    onDelete: (user) => window.api.deleteTeamHubUser(hub.id, user.id),
    onSuccess: reload,
    successMessage: 'User deleted.'
  });
  const [saving, setSaving] = useState(false);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [reissuingUserId, setReissuingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resourceOptions, setResourceOptions] = useState<TeamHubAdminResourceOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  /**
   * Resolves a user display name from the loaded user list.
   *
   * @param userId - User account identifier from an invitation record.
   */
  const resolveUserName = (userId: string): string => {
    return users.find((user) => user.id === userId)?.name || userId;
  };

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
   * Closes the invite modal and clears action errors.
   */
  const closeInviteModal = (): void => {
    if (saving) {
      return;
    }

    setInvitingUser(false);
    setResourceOptions(null);
    setOptionsLoading(false);
    setActionError(null);
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
   * Opens the invite user modal and loads resource options.
   */
  const handleInviteClick = (): void => {
    setActionError(null);
    setInvitingUser(true);
    loadResourceOptions();
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
   * Creates an invited user account and shows the one-time join link.
   *
   * @param input - User fields for the invited account.
   */
  const handleInviteUser = async (input: CreateInvitedHubUserInput): Promise<void> => {
    setSaving(true);
    setActionError(null);

    try {
      const created = await window.api.createTeamHubInvitedUser(hub.id, input);
      setInvitingUser(false);
      setInvitationLink(buildInvitationLink(created, hub));
      reload();
      reloadInvitations();
      await dispatch(refreshCollections());
      toast.success('Invitation created.');
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
   * Revokes a pending invitation so it can no longer be redeemed.
   *
   * @param invitationId - Invitation record identifier.
   */
  const handleRevokeInvitation = async (invitationId: string): Promise<void> => {
    setRevokingInvitationId(invitationId);
    setActionError(null);

    try {
      await window.api.revokeTeamHubInvitation(hub.id, invitationId);
      reloadInvitations();
      toast.success('Invitation revoked.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRevokingInvitationId(null);
    }
  };

  /**
   * Reissues an onboarding invitation for an existing user account.
   *
   * @param userId - User account identifier.
   */
  const handleReissueInvitation = async (userId: string): Promise<void> => {
    setReissuingUserId(userId);
    setActionError(null);

    try {
      const created = await window.api.createTeamHubUserInvitation(hub.id, userId);
      setInvitationLink(buildInvitationLink(created, hub));
      reloadInvitations();
      toast.success('Invitation reissued.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setReissuingUserId(null);
    }
  };

  return (
    <Page
      embedded
      title="Users"
      icon={faUsers}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="toolbar"
            className="whitespace-nowrap"
            onClick={handleCreateClick}
          >
            Create user
          </Button>
          <Button type="button" className="whitespace-nowrap" onClick={handleInviteClick}>
            Invite user
          </Button>
        </div>
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
                  <Button type="button" variant="toolbar" onClick={() => handleEdit(user)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="toolbar"
                    className={toolbarDangerButtonClass}
                    onClick={() => deleteUser.open(user)}
                  >
                    Delete
                  </Button>
                </>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      <div className="mt-8">
        <h3 className="mb-3 text-[15px] font-semibold">Invitations</h3>
        <AsyncListState
          loading={invitationsLoading}
          error={invitationsError}
          onRetry={reloadInvitations}
          isEmpty={invitations.length === 0}
          emptyMessage="No invitations found."
        >
          <ResourceList>
            {invitations.map((invitation) => (
              <ResourceListRow
                key={invitation.id}
                primary={
                  <div className="flex min-w-0 items-center gap-2">
                    <ResourceListPrimary>{resolveUserName(invitation.userId)}</ResourceListPrimary>
                    <Badge variant={invitationBadgeVariant(invitation.status)}>
                      {invitation.status}
                    </Badge>
                  </div>
                }
                secondary={`${invitation.codePrefix} · expires ${new Date(invitation.expiresAt).toLocaleString()}`}
                actions={
                  <>
                    {invitation.status === 'pending' ? (
                      <Button
                        type="button"
                        variant="toolbar"
                        className={toolbarDangerButtonClass}
                        disabled={revokingInvitationId === invitation.id}
                        onClick={() => void handleRevokeInvitation(invitation.id)}
                      >
                        {revokingInvitationId === invitation.id ? 'Revoking…' : 'Revoke'}
                      </Button>
                    ) : null}
                    {invitation.status !== 'pending' ? (
                      <Button
                        type="button"
                        variant="toolbar"
                        disabled={reissuingUserId === invitation.userId}
                        onClick={() => void handleReissueInvitation(invitation.userId)}
                      >
                        {reissuingUserId === invitation.userId ? 'Reissuing…' : 'Reissue'}
                      </Button>
                    ) : null}
                  </>
                }
              />
            ))}
          </ResourceList>
        </AsyncListState>
      </div>

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

      {invitingUser && (
        <Modal
          className="w-[520px]"
          labelledBy="team-user-invite-title"
          onClose={closeInviteModal}
          title="Invite user"
          description="Creates a user account and a one-time join link. Share the link instead of handing off a raw API token."
          closeDisabled={saving}
          disableEscape={saving}
        >
          <ModalFormLayout
            error={actionError ? <FieldError spacing="modal">{actionError}</FieldError> : null}
            actions={
              <Button type="submit" form={inviteFormId} disabled={saving}>
                {saving ? 'Inviting…' : 'Create invitation'}
              </Button>
            }
          >
            <TeamUserForm
              key="invite-user"
              mode="create"
              disabled={saving}
              resourceOptions={resourceOptions}
              optionsLoading={optionsLoading}
              formId={inviteFormId}
              onSubmit={handleInviteUser}
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

      {invitationLink && (
        <TeamInvitationLinkDialog
          title="Invitation created"
          description="Copy this https:// invite link now and send it to the invitee. They should click the link or paste it into File → Accept Team Hub Invite. The one-time invitation code will not be shown again."
          joinLink={invitationLink}
          onClose={() => setInvitationLink(null)}
        />
      )}

      {createdSecret && (
        <TeamSecretDialog
          title="User created"
          description="Copy this API token secret now. It will not be shown again."
          secret={createdSecret}
          onClose={() => setCreatedSecret(null)}
        />
      )}

      {deleteUser.target ? (
        <DeleteConfirmModal
          title="Delete user?"
          description={
            <>
              This permanently deletes &ldquo;{deleteUser.target.name || 'Untitled'}&rdquo; and
              revokes all of their API tokens.
            </>
          }
          busy={deleteUser.busy}
          error={deleteUser.error}
          onConfirm={() => void deleteUser.confirm()}
          onClose={deleteUser.close}
        />
      ) : null}
    </Page>
  );
}
