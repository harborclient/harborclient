import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { HubApiTokenRecord, HubUserRecord, TeamHub } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { useTeamHubTokens } from '#/renderer/src/hooks/useTeamHubTokens';
import { useTeamHubUsers } from '#/renderer/src/hooks/useTeamHubUsers';
import { TeamSecretDialog } from '#/renderer/src/ui/TeamHubs/TeamSecretDialog';

interface Props {
  /**
   * Team hub connections with admin tokens.
   */
  adminHubs: TeamHub[];

  /**
   * Returns to the team hub list view.
   */
  onBack: () => void;
}

/**
 * Sorts team hubs by display name for stable default selection.
 *
 * @param hubs - Admin hub connections to sort.
 * @returns Hubs ordered by name.
 */
function sortHubsByName(hubs: TeamHub[]): TeamHub[] {
  return [...hubs].sort((left, right) =>
    (left.name || left.baseUrl).localeCompare(right.name || right.baseUrl)
  );
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
export function TeamTokensView({ adminHubs, onBack }: Props): JSX.Element {
  const sortedHubs = useMemo(() => sortHubsByName(adminHubs), [adminHubs]);
  const [selectedHubId, setSelectedHubId] = useState(sortedHubs[0]?.id ?? '');
  const selectedHubIdOrNull = selectedHubId.length > 0 ? selectedHubId : null;
  const { tokens, loading, error, reload } = useTeamHubTokens(selectedHubIdOrNull);
  const { users } = useTeamHubUsers(selectedHubIdOrNull);
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
    if (!selectedHubIdOrNull || createUserId.length === 0 || createTokenName.trim().length === 0) {
      return;
    }

    setCreating(true);
    setActionError(null);

    try {
      const created = await window.api.createTeamHubUserToken(selectedHubIdOrNull, createUserId, {
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
    if (!selectedHubIdOrNull || !deletingToken || deleteConfirmText !== 'DELETE') {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      await window.api.deleteTeamHubToken(selectedHubIdOrNull, deletingToken.id);
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 mb-1 text-[14px] font-medium text-text">Tokens</h2>
          <p className="m-0 text-[14px] text-muted">
            API bearer tokens across all users on the selected Team Hub server.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={handleCreateClick} disabled={users.length === 0}>
            Create token
          </Button>
          <Button type="button" variant="secondary" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>

      {sortedHubs.length > 1 && (
        <div className="mb-4">
          <label htmlFor="team-tokens-hub" className="mb-1 block text-[14px] font-medium text-text">
            Team hub
          </label>
          <select
            id="team-tokens-hub"
            className="w-full max-w-md rounded-md border border-separator bg-surface px-3 py-2 text-[14px] text-text"
            value={selectedHubId}
            onChange={(event) => setSelectedHubId(event.target.value)}
          >
            {sortedHubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name || hub.baseUrl}
              </option>
            ))}
          </select>
        </div>
      )}

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeCreateModal}
        >
          <div
            className="w-[480px] rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-token-create-title"
          >
            <h2
              id="team-token-create-title"
              className="m-0 mb-1 text-[14px] font-semibold text-text"
            >
              Create token
            </h2>
            <p className="mb-4 text-[14px] text-muted">
              The token secret will be shown once after creation.
            </p>

            <label
              htmlFor="team-token-user"
              className="mb-1 block text-[14px] font-medium text-text"
            >
              User
            </label>
            <select
              id="team-token-user"
              className="mb-4 w-full rounded-md border border-separator bg-surface px-3 py-2 text-[14px] text-text"
              value={createUserId}
              disabled={creating}
              onChange={(event) => setCreateUserId(event.target.value)}
            >
              {users.map((user: HubUserRecord) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.id}
                </option>
              ))}
            </select>

            <label
              htmlFor="team-token-name"
              className="mb-1 block text-[14px] font-medium text-text"
            >
              Token name
            </label>
            <input
              id="team-token-name"
              type="text"
              className="w-full rounded-md border border-separator bg-surface px-3 py-2 text-[14px] text-text"
              value={createTokenName}
              disabled={creating}
              autoComplete="off"
              onChange={(event) => setCreateTokenName(event.target.value)}
            />

            {actionError && <p className="mt-4 text-[14px] text-danger">{actionError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={creating}
                onClick={closeCreateModal}
              >
                Cancel
              </Button>
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
          </div>
        </div>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeDeleteModal}
        >
          <div
            className="w-[480px] rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-token-delete-title"
          >
            <h2
              id="team-token-delete-title"
              className="m-0 mb-1 text-[14px] font-semibold text-text"
            >
              Delete token?
            </h2>
            <p className="mb-4 text-[14px] text-muted">
              This permanently deletes &ldquo;{deletingToken.name || 'Untitled'}&rdquo; (
              {deletingToken.tokenPrefix}). Type <strong>DELETE</strong> to confirm.
            </p>

            <label
              htmlFor="team-token-delete-confirm"
              className="mb-1 block text-[14px] font-medium text-text"
            >
              Confirmation
            </label>
            <input
              id="team-token-delete-confirm"
              type="text"
              className="w-full rounded-md border border-separator bg-surface px-3 py-2 text-[14px] text-text"
              value={deleteConfirmText}
              disabled={deleting}
              autoComplete="off"
              onChange={(event) => setDeleteConfirmText(event.target.value)}
            />

            {actionError && <p className="mt-4 text-[14px] text-danger">{actionError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={deleting}
                onClick={closeDeleteModal}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondaryDanger"
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                onClick={() => void handleConfirmDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
