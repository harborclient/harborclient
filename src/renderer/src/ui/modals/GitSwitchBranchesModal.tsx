import { Button, FaIcon, Modal } from '@harborclient/sdk/components';
import { useCallback, useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SourceControlStatus } from '#/shared/types';
import { faCircleCheck } from '#/renderer/src/fontawesome';
import {
  isBranchSwitchDisabled,
  shouldBlockBranchSwitch
} from '#/renderer/src/git/gitBranchModalHelpers';

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
   * Called after a successful branch switch to refresh sidebar status.
   */
  onRefresh: () => void;
}

/**
 * Lists local branches and switches to the selected branch when the working tree is clean.
 */
export function GitSwitchBranchesModal({
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
  const hasUncommittedChanges = shouldBlockBranchSwitch(status?.changedCount ?? 0);

  /**
   * Loads local branch names when the modal opens.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    void window.api
      .gitListBranches(connectionId)
      .then((names) => setBranches(names))
      .catch((err) => {
        setBranches([]);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoaded(true));
  }, [connectionId, open]);

  /**
   * Checks out the selected branch and refreshes git status on success.
   *
   * @param branch - Branch name to check out.
   */
  const handleSwitch = useCallback(
    async (branch: string): Promise<void> => {
      if (busy || branch === currentBranch || hasUncommittedChanges) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await window.api.gitCheckoutBranch(connectionId, branch);
        onRefresh();
        toast.success(`Switched to branch "${branch}"`);
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, connectionId, currentBranch, hasUncommittedChanges, onClose, onRefresh]
  );

  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      className="w-[32rem]"
      labelledBy="git-switch-branches-title"
      title={`Switch branch — ${connectionName}`}
    >
      <div className="flex flex-col gap-3">
        {hasUncommittedChanges && (
          <p className="m-0 text-muted" role="status">
            Commit or discard your changes before switching branches.
          </p>
        )}
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
              const disabled = isBranchSwitchDisabled({
                currentBranch,
                targetBranch: branch,
                busy,
                changedCount: status?.changedCount ?? 0
              });

              return (
                <li key={branch}>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    disabled={disabled}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={
                      isCurrent
                        ? `${branch} (current branch)`
                        : hasUncommittedChanges
                          ? `${branch} (unavailable while there are uncommitted changes)`
                          : `Switch to branch ${branch}`
                    }
                    onClick={() => void handleSwitch(branch)}
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
