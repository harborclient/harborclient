import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { HubApiTokenRecord, HubUserRecord, TeamHub } from '#/shared/types';
import { Input, Select } from '#/renderer/src/components/forms';
import { Button } from '#/renderer/src/components/Button';
import { FormGroup } from '#/renderer/src/components/FormGroup';
import { Modal, ModalFormLayout } from '#/renderer/src/components/Modal';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { BackButton } from '#/renderer/src/components/BackButton';
import { AsyncListState } from '#/renderer/src/components/AsyncListState';
import {
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '#/renderer/src/components/ResourceList';
import { FieldError } from '#/renderer/src/components/FieldError';
import { useTeamHubTokens } from '#/renderer/src/hooks/useTeamHubTokens';
import { useTeamHubUsers } from '#/renderer/src/hooks/useTeamHubUsers';
import { TeamSecretDialog } from '#/renderer/src/ui/TeamHub/TeamSecretDialog';

interface Props {
  /**
   * Admin team hub connection whose API tokens are being managed.
   */
  hub: TeamHub;

  /**
   * Returns to the team hub list view.
   */
  onBack: () => void;
}

/**
 * Formats an optional ISO timestamp for display.
 *
 * @param value - Timestamp string or null when unset.
 * @returns Formatted timestamp or a dash placeholder.
 */
function formatOptionalTimestamp(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

/**
 * Team Hub API token administration view for operator tokens.
 */
export function TeamTokensView({ hub, onBack }: Props): JSX.Element {
  const { tokens, loading, error, reload } = useTeamHubTokens(hub.id);
  const { users } = useTeamHubUsers(hub.id);
  const userNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.id, user.name);
    }
    return map;
  }, [users]);

  const [creatingToken, setCreatingToken] = useState(false);
  const [createUserId, setCreateUserId] = useState('');
  const [createTokenName, setCreateTokenName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [deletingToken, setDeletingToken] = useState<HubApiTokenRecord | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Opens the create token modal with defaults from the user list.
   */
  const handleCreateClick = (): void => {
    setActionError(null);
    setCreateUserId(users[0]?.id ?? '');
    setCreateTokenName('');
    setCreatingToken(true);
  };

  /**
   * Closes the create token modal.
   */
  const closeCreateModal = (): void => {
    if (creating) {
      return;
    }

    setCreatingToken(false);
    setCreateUserId('');
    setCreateTokenName('');
    setActionError(null);
  };

  /**
   * Creates a new API token and shows the one-time secret.
   */
  const handleConfirmCreate = async (): Promise<void> => {
    if (createUserId.length === 0 || createTokenName.trim().length === 0) {
      return;
    }

    setCreating(true);
    setActionError(null);

    try {
      const created = await window.api.createTeamHubUserToken(hub.id, createUserId, {
        name: createTokenName.trim()
      });
      setCreatingToken(false);
      setCreateUserId('');
      setCreateTokenName('');
      setCreatedSecret(created.secret);
      reload();
      toast.success('Token created.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  /**
   * Opens the delete confirmation modal for a token row.
   *
   * @param token - Token record to delete.
   */
  const handleDeleteClick = (token: HubApiTokenRecord): void => {
    setActionError(null);
    setDeleteConfirmText('');
    setDeletingToken(token);
  };

  /**
   * Closes the delete confirmation modal.
   */
  const closeDeleteModal = (): void => {
    if (deleting) {
      return;
    }

    setDeletingToken(null);
    setDeleteConfirmText('');
    setActionError(null);
  };

  /**
   * Permanently deletes the selected token after confirmation.
   */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletingToken || deleteConfirmText !== 'DELETE') {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      await window.api.deleteTeamHubToken(hub.id, deletingToken.id);
      setDeletingToken(null);
      setDeleteConfirmText('');
      reload();
      toast.success('Token deleted.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Tokens" description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}>
        <Button
          type="button"
          className="shrink-0 whitespace-nowrap"
          onClick={handleCreateClick}
          disabled={users.length === 0}
        >
          Create token
        </Button>
        <BackButton onClick={onBack} />
      </PageHeader>

      <AsyncListState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={tokens.length === 0}
        emptyMessage="No tokens found."
      >
        <ResourceList>
          {tokens.map((token) => (
            <ResourceListRow
              key={token.id}
              primary={
                <div className="flex min-w-0 items-center gap-2">
                  <ResourceListPrimary>{token.name || 'Untitled'}</ResourceListPrimary>
                  <span className="truncate font-mono text-[13px] text-muted">
                    {token.tokenPrefix}
                  </span>
                </div>
              }
              secondary={userNamesById.get(token.userId) ?? token.userId}
              meta={
                <span className="block truncate text-[13px] text-muted">
                  Created {formatOptionalTimestamp(token.createdAt)}
                  {token.lastUsedAt
                    ? ` · Last used ${formatOptionalTimestamp(token.lastUsedAt)}`
                    : ''}
                </span>
              }
              actions={
                <Button type="button" variant="secondary" onClick={() => handleDeleteClick(token)}>
                  Delete
                </Button>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {creatingToken && (
        <Modal
          className="w-[480px]"
          labelledBy="team-token-create-title"
          onClose={closeCreateModal}
          title="Create token"
          description="The token secret will be shown once after creation."
          closeDisabled={creating}
          disableEscape={creating}
        >
          <ModalFormLayout
            error={actionError ? <FieldError spacing="modal">{actionError}</FieldError> : null}
            actions={
              <Button
                type="button"
                disabled={
                  creating || createUserId.length === 0 || createTokenName.trim().length === 0
                }
                onClick={() => void handleConfirmCreate()}
              >
                {creating ? 'Creating…' : 'Create'}
              </Button>
            }
          >
            <FormGroup label="User" htmlFor="team-token-user">
              <Select
                id="team-token-user"
                variant="surface"
                className="mb-4"
                value={createUserId}
                disabled={creating}
                onChange={(event) => setCreateUserId(event.target.value)}
              >
                {users.map((user: HubUserRecord) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.id}
                  </option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup label="Token name" htmlFor="team-token-name">
              <Input
                id="team-token-name"
                type="text"
                variant="surface"
                value={createTokenName}
                disabled={creating}
                autoComplete="off"
                onChange={(event) => setCreateTokenName(event.target.value)}
              />
            </FormGroup>
          </ModalFormLayout>
        </Modal>
      )}

      {createdSecret && (
        <TeamSecretDialog
          title="Token created"
          description="Copy this API token secret now. It will not be shown again."
          secret={createdSecret}
          onClose={() => setCreatedSecret(null)}
        />
      )}

      {deletingToken && (
        <Modal
          className="w-[480px]"
          labelledBy="team-token-delete-title"
          onClose={closeDeleteModal}
          title="Delete token?"
          description={
            <>
              This permanently deletes &ldquo;{deletingToken.name || 'Untitled'}&rdquo; (
              {deletingToken.tokenPrefix}). Type <strong>DELETE</strong> to confirm.
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
                variant="secondaryDanger"
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                onClick={() => void handleConfirmDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            }
          >
            <FormGroup label="Confirmation" htmlFor="team-token-delete-confirm">
              <Input
                id="team-token-delete-confirm"
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
    </div>
  );
}
