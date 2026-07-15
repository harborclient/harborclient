import { PromptModal } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { canCreateGitBranch } from '#/renderer/src/git/gitBranchModalHelpers';

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
   * Called when the modal should close.
   */
  onClose: () => void;

  /**
   * Called after a successful branch operation to refresh sidebar status.
   */
  onRefresh: () => void;
}

/**
 * Prompts for a new branch name and creates it from the current commit.
 */
export function GitCreateBranchModal({
  open,
  connectionId,
  connectionName,
  onClose,
  onRefresh
}: Props): JSX.Element | null {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resets modal state and closes.
   */
  const handleClose = useCallback((): void => {
    setName('');
    setError(null);
    onClose();
  }, [onClose]);

  /**
   * Creates the branch and refreshes git status on success.
   */
  const handleCreate = useCallback(async (): Promise<void> => {
    const trimmed = name.trim();
    if (!canCreateGitBranch(name, busy)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await window.api.gitCreateBranch(connectionId, trimmed);
      onRefresh();
      toast.success(`Created branch "${trimmed}"`);
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [busy, connectionId, handleClose, name, onRefresh]);

  if (!open) {
    return null;
  }

  return (
    <PromptModal
      title={`Create branch — ${connectionName}`}
      labelledBy="git-create-branch-title"
      label="Branch name"
      value={name}
      onChange={setName}
      onSubmit={() => void handleCreate()}
      onClose={handleClose}
      submitLabel="Branch"
      busy={busy}
      error={error}
      canSubmit={(value) => canCreateGitBranch(value, busy)}
      className="w-[32rem]"
    />
  );
}
