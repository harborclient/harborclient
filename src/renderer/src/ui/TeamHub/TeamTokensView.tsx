import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { HubApiTokenRecord, HubUserRecord, TeamHub } from '#/shared/types';
import { Input, Select } from '#/renderer/src/components/forms';
import { Button } from '#/renderer/src/components/Button';
import { Modal } from '#/renderer/src/components/Modal';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faAngleLeft } from '#/renderer/src/fontawesome';
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
        <Button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          onClick={onBack}
        >
          <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" aria-hidden />
          Back
        </Button>
      </PageHeader>

      {loading ? (
        <p className="text-[14px] text-muted">Loading…</p>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mb-0 text-[14px] text-danger">{error}</p>
          <Button type="button" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-[14px] text-muted">No tokens found.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex items-center justify-between gap-3 rounded-md border border-separator px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-text">
                    {token.name || 'Untitled'}
                  </span>
                  <span className="truncate font-mono text-[13px] text-muted">
                    {token.tokenPrefix}
                  </span>
                </div>
                <span className="truncate text-[14px] text-muted">
                  {userNamesById.get(token.userId) ?? token.userId}
                </span>
                <span className="block truncate text-[13px] text-muted">
                  Created {formatOptionalTimestamp(token.createdAt)}
                  {token.lastUsedAt
                    ? ` · Last used ${formatOptionalTimestamp(token.lastUsedAt)}`
                    : ''}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => handleDeleteClick(token)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
          <label htmlFor="team-token-user" className="mb-1 block text-[14px] font-medium text-text">
            User
          </label>
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

          <label htmlFor="team-token-name" className="mb-1 block text-[14px] font-medium text-text">
            Token name
          </label>
          <Input
            id="team-token-name"
            type="text"
            variant="surface"
            value={createTokenName}
            disabled={creating}
            autoComplete="off"
            onChange={(event) => setCreateTokenName(event.target.value)}
          />

          {actionError && <p className="mt-4 text-[14px] text-danger">{actionError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              disabled={
                creating || createUserId.length === 0 || createTokenName.trim().length === 0
              }
              onClick={() => void handleConfirmCreate()}
            >
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
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
          <label
            htmlFor="team-token-delete-confirm"
            className="mb-1 block text-[14px] font-medium text-text"
          >
            Confirmation
          </label>
          <Input
            id="team-token-delete-confirm"
            type="text"
            variant="surface"
            value={deleteConfirmText}
            disabled={deleting}
            autoComplete="off"
            onChange={(event) => setDeleteConfirmText(event.target.value)}
          />

          {actionError && <p className="mt-4 text-[14px] text-danger">{actionError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondaryDanger"
              disabled={deleting || deleteConfirmText !== 'DELETE'}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
