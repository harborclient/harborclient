import {
  AsyncListState,
  Button,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFormLayout,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow,
  Select
} from '@harborclient/sdk/components';
import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { HubApiTokenRecord, HubUserRecord, TeamHub } from '#/shared/types';

import { faUsers } from '#/renderer/src/fontawesome';

import { useTeamHubTokens } from '#/renderer/src/hooks/useTeamHubTokens';
import { useTeamHubUsers } from '#/renderer/src/hooks/useTeamHubUsers';
import { useTypedDeleteConfirm } from '#/renderer/src/hooks/useTypedDeleteConfirm';
import { TeamSecretDialog } from '#/renderer/src/ui/TeamHub/TeamSecretDialog';
import { DeleteConfirmModal } from '#/renderer/src/ui/Shared/DeleteConfirm/DeleteConfirmModal';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';

interface Props {
  /**
   * Admin team hub connection whose API tokens are being managed.
   */
  hub: TeamHub;
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
export function TeamTokensView({ hub }: Props): JSX.Element {
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
  const [actionError, setActionError] = useState<string | null>(null);
  const deleteToken = useTypedDeleteConfirm<HubApiTokenRecord>({
    onDelete: (token) => window.api.deleteTeamHubToken(hub.id, token.id),
    onSuccess: reload,
    successMessage: 'Token deleted.'
  });

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

  return (
    <Page
      embedded
      title="Tokens"
      icon={faUsers}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
      actions={
        <Button
          type="button"
          className="shrink-0 whitespace-nowrap"
          onClick={handleCreateClick}
          disabled={users.length === 0}
        >
          Create token
        </Button>
      }
    >
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
                <Button
                  type="button"
                  variant="toolbar"
                  className={toolbarDangerButtonClass}
                  onClick={() => deleteToken.open(token)}
                >
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

      {deleteToken.target ? (
        <DeleteConfirmModal
          title="Delete token?"
          description={
            <>
              This permanently deletes &ldquo;{deleteToken.target.name || 'Untitled'}&rdquo; (
              {deleteToken.target.tokenPrefix}).
            </>
          }
          busy={deleteToken.busy}
          error={deleteToken.error}
          onConfirm={() => void deleteToken.confirm()}
          onClose={deleteToken.close}
        />
      ) : null}
    </Page>
  );
}
