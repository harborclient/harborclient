import { Button, FaIcon, Modal } from '@harborclient/sdk/components';
import { useCallback, useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SourceControlStatus } from '#/shared/types';
import { faCircleCheck } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * Git connection id for branch operations.
   */
  connectionId: string;

  /**
   * Display name of the git connection.
   */
  connectionName: string;

  /**
   * Current source-control status for the connection.
   */
  status: SourceControlStatus | null;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;

  /**
   * Called after a successful branch deletion to refresh sidebar status.
   */
  onRefresh: () => void;
}

/**
 * Lists local branches and deletes the selected branch when it is not checked out.
 */
export function GitDeleteBranchModal({
  open,
  connectionId,
  connectionName,
  status,
  onClose,
  onRefresh
}: Props): JSX.Element | null {
  const [branches, setBranches] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBranch = status?.branch ?? null;

  /**
   * Loads local branch names when the modal opens.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    void window.api
      .gitListBranches(connectionId)
      .then((names) => {
        setBranches(names);
        setError(null);
      })
      .catch((err) => {
        setBranches([]);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoaded(true));
  }, [connectionId, open]);

  /**
   * Deletes the selected local branch and refreshes git status on success.
   *
   * @param branch - Branch name to delete.
   */
  const handleDeleteBranch = useCallback(
    async (branch: string): Promise<void> => {
      if (busy || branch === currentBranch) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await window.api.gitDeleteBranch(connectionId, branch);
        onRefresh();
        toast.success(`Deleted branch "${branch}"`);
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, connectionId, currentBranch, onClose, onRefresh]
  );

  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      className="w-[32rem]"
      labelledBy="git-delete-branch-title"
      title={`Delete branch — ${connectionName}`}
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[14px] text-muted" role="status">
          Delete a local branch. The currently checked-out branch cannot be deleted.
        </p>
        {!loaded ? (
          <p className="m-0 text-muted" role="status">
            Loading branches…
          </p>
        ) : branches.length === 0 ? (
          <p className="m-0 text-muted" role="status">
            No local branches found.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {branches.map((branch) => {
              const isCurrent = branch === currentBranch;
              const disabled = busy || isCurrent;

              return (
                <li key={branch}>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    disabled={disabled}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={
                      isCurrent ? `${branch} (current branch)` : `Delete branch ${branch}`
                    }
                    onClick={() => void handleDeleteBranch(branch)}
                  >
                    <span>{branch}</span>
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[14px] text-muted">
                        <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5" aria-hidden />
                        <span>current</span>
                      </span>
                    ) : null}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {error != null && (
          <p className="m-0 text-[14px] text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
