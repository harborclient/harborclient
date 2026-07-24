import { Button, FaIcon, Input, Modal } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SourceControlStatus } from '#/shared/types';
import {
  filterBranches,
  isBranchDeleteDisabled,
  isBranchMergeDisabled,
  isBranchSwitchDisabled,
  shouldBlockBranchSwitch
} from '#/renderer/src/git/gitBranchModalHelpers';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { showConfirm } from './dialogHelpers';
import {
  faCircleCheck,
  faCodeBranch,
  faDiagramProject,
  faPlus,
  faTrash
} from '#/renderer/src/fontawesome';

const SEARCH_INPUT_ID = 'git-branches-search';

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
   * Called after a successful branch operation to refresh sidebar status.
   */
  onRefresh: () => void;

  /**
   * Opens the dedicated create-branch dialog for this connection.
   */
  onCreateBranch?: () => void;

  /**
   * Whether the modal is for switching/creating branches or merging into the current branch.
   */
  mode?: 'branches' | 'merge';

  /**
   * Monotonically increasing token that forces the branch list to reload when it
   * changes. Callers bump this after external branch mutations (e.g. creating a
   * branch from the sibling create-branch dialog) so the list stays in sync.
   */
  reloadToken?: number;
}

/**
 * VS Code-style branch picker: filter branches, switch on selection,
 * and merge other branches into the current branch.
 */
export function GitBranchesModal({
  open,
  connectionId,
  connectionName,
  status,
  onClose,
  onRefresh,
  onCreateBranch,
  mode = 'branches',
  reloadToken = 0
}: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const [branches, setBranches] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const currentBranch = status?.branch ?? null;
  const hasUncommittedChanges = shouldBlockBranchSwitch(status?.changedCount ?? 0);
  const isMergeMode = mode === 'merge';

  /**
   * Modal title reflecting whether the user is switching or merging branches.
   */
  const modalTitle = useMemo((): string => {
    if (isMergeMode) {
      return currentBranch != null
        ? `Merge into "${currentBranch}" — ${connectionName}`
        : `Merge — ${connectionName}`;
    }

    return `Branches — ${connectionName}`;
  }, [connectionName, currentBranch, isMergeMode]);

  /**
   * Filters the loaded branch list by the current search query.
   */
  const filteredBranches = useMemo(() => filterBranches(branches, query), [branches, query]);

  /**
   * Resets modal state and closes.
   */
  const handleClose = useCallback((): void => {
    setQuery('');
    setError(null);
    onClose();
  }, [onClose]);

  /**
   * Loads local branch names when the modal opens and whenever `reloadToken`
   * changes, keeping the list current after external branch mutations.
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
  }, [connectionId, open, reloadToken]);

  /**
   * Switches to the selected branch and refreshes git status on success.
   *
   * @param branch - Branch name to check out.
   */
  const handleSwitchBranch = useCallback(
    async (branch: string): Promise<void> => {
      if (
        busy ||
        isBranchSwitchDisabled({
          currentBranch,
          targetBranch: branch,
          busy,
          changedCount: status?.changedCount ?? 0
        })
      ) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await window.api.gitCheckoutBranch(connectionId, branch);
        onRefresh();
        toast.success(`Switched to branch "${branch}"`);
        handleClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, connectionId, currentBranch, handleClose, onRefresh, status?.changedCount]
  );

  /**
   * Merges the selected branch into the current branch.
   *
   * @param branch - Branch name to merge into the current branch.
   */
  const handleMergeBranch = useCallback(
    async (branch: string): Promise<void> => {
      if (
        isBranchMergeDisabled({
          currentBranch,
          targetBranch: branch,
          busy
        })
      ) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const result = await window.api.gitMergeBranch(connectionId, branch);
        onRefresh();
        if (result.conflictCount > 0) {
          toast(`${result.conflictCount} merge conflict(s) — resolve them in the Git sidebar.`, {
            icon: '⚠️',
            duration: 8000
          });
          handleClose();
          return;
        }

        toast.success(`Merged branch "${branch}"`);

        const deleteMergedBranch = await showConfirm(dispatch, {
          title: 'Delete merged branch?',
          message:
            currentBranch != null
              ? `Branch "${branch}" was merged into "${currentBranch}". Delete the merged branch?`
              : `Branch "${branch}" was merged. Delete the merged branch?`,
          confirmLabel: 'Delete branch',
          cancelLabel: 'Keep branch',
          variant: 'danger'
        });

        if (deleteMergedBranch) {
          try {
            await window.api.gitDeleteBranch(connectionId, branch);
            onRefresh();
            toast.success(`Deleted branch "${branch}"`);
          } catch (deleteErr) {
            const message = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
            setError(message);
            toast.error(message);
          }
        }

        handleClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, connectionId, currentBranch, dispatch, handleClose, onRefresh]
  );

  /**
   * Deletes the selected local branch after user confirmation.
   *
   * @param branch - Branch name to delete.
   */
  const handleDeleteBranch = useCallback(
    async (branch: string): Promise<void> => {
      if (
        isBranchDeleteDisabled({
          currentBranch,
          targetBranch: branch,
          busy
        })
      ) {
        return;
      }

      const confirmed = await showConfirm(dispatch, {
        title: 'Delete branch?',
        message: `Delete local branch "${branch}"? This cannot be undone.`,
        confirmLabel: 'Delete branch',
        cancelLabel: 'Cancel',
        variant: 'danger'
      });

      if (!confirmed) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await window.api.gitDeleteBranch(connectionId, branch);
        setBranches((previous) => previous.filter((name) => name !== branch));
        onRefresh();
        toast.success(`Deleted branch "${branch}"`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, connectionId, currentBranch, dispatch, onRefresh]
  );

  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={handleClose}
      className="w-[32rem]"
      labelledBy="git-branches-title"
      title={modalTitle}
    >
      {!isMergeMode && onCreateBranch != null ? (
        <Button
          type="button"
          variant="primary"
          className="w-full justify-start gap-2 mb-4"
          disabled={busy}
          aria-label="Create new branch"
          onClick={onCreateBranch}
        >
          <FaIcon icon={faPlus} className="h-3.5 w-3.5" aria-hidden />
          <span>Create branch</span>
        </Button>
      ) : null}
      <div>
        <h3 className="mb-1">Branches</h3>
        <div className="flex flex-col gap-3">
          <Input
            id={SEARCH_INPUT_ID}
            className="w-full"
            type="search"
            autoFocus
            value={query}
            disabled={busy}
            placeholder={isMergeMode ? 'Search a branch to merge…' : 'Search branches…'}
            aria-label={isMergeMode ? 'Search a branch to merge' : 'Search branches'}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="flex h-[20rem] flex-col overflow-hidden">
            {!loaded ? (
              <p className="m-0 text-muted" role="status">
                Loading branches…
              </p>
            ) : filteredBranches.length === 0 ? (
              <p className="m-0 text-muted" role="status">
                {branches.length === 0
                  ? 'No local branches found.'
                  : 'No branches match your search.'}
              </p>
            ) : (
              <ul className="m-0 flex h-full list-none flex-col gap-2 overflow-y-auto p-0">
                {filteredBranches.map((branch) => {
                  const isCurrent = branch === currentBranch;
                  const switchDisabled = isBranchSwitchDisabled({
                    currentBranch,
                    targetBranch: branch,
                    busy,
                    changedCount: status?.changedCount ?? 0
                  });
                  const mergeDisabled = isBranchMergeDisabled({
                    currentBranch,
                    targetBranch: branch,
                    busy
                  });
                  const rowDisabled = isMergeMode ? mergeDisabled : switchDisabled;

                  /**
                   * Accessible name for the primary branch row action.
                   */
                  const primaryAriaLabel = ((): string => {
                    if (isCurrent) {
                      return `${branch} (current branch)`;
                    }

                    if (isMergeMode) {
                      return currentBranch != null
                        ? `Merge branch ${branch} into ${currentBranch}`
                        : `Merge branch ${branch}`;
                    }

                    if (hasUncommittedChanges) {
                      return `${branch} (unavailable while there are uncommitted changes)`;
                    }

                    return `Switch to branch ${branch}`;
                  })();

                  const mergeAriaLabel =
                    currentBranch != null
                      ? `Merge branch ${branch} into ${currentBranch}`
                      : `Merge branch ${branch}`;
                  const deleteDisabled = isBranchDeleteDisabled({
                    currentBranch,
                    targetBranch: branch,
                    busy
                  });
                  const deleteAriaLabel = `Delete branch ${branch}`;

                  /**
                   * Runs the primary row action for the current modal mode.
                   */
                  const handlePrimaryAction = (): void => {
                    if (isMergeMode) {
                      void handleMergeBranch(branch);
                      return;
                    }

                    void handleSwitchBranch(branch);
                  };

                  return (
                    <li key={branch}>
                      <div className="flex items-stretch gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-w-0 flex-1 justify-between"
                          disabled={rowDisabled}
                          aria-current={isCurrent ? 'true' : undefined}
                          aria-label={primaryAriaLabel}
                          title={primaryAriaLabel}
                          onClick={handlePrimaryAction}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <FaIcon
                              icon={faCodeBranch}
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden
                            />
                            <span className="truncate">{branch}</span>
                          </span>
                          {isCurrent ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[14px] text-muted">
                              <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5" aria-hidden />
                              <span>current</span>
                            </span>
                          ) : null}
                        </Button>
                        {!isCurrent && !isMergeMode ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              className="shrink-0 px-3"
                              disabled={busy}
                              aria-label={mergeAriaLabel}
                              title={mergeAriaLabel}
                              onClick={() => void handleMergeBranch(branch)}
                            >
                              <FaIcon icon={faDiagramProject} className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="shrink-0 px-3"
                              disabled={deleteDisabled}
                              aria-label={deleteAriaLabel}
                              title={deleteAriaLabel}
                              onClick={() => void handleDeleteBranch(branch)}
                            >
                              <FaIcon icon={faTrash} className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error != null && (
            <p className="m-0 text-[14px] text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
