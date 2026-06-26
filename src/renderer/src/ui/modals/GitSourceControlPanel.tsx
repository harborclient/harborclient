import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GitLogEntry, SourceControlStatus } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { Modal } from '#/renderer/src/components/Modal';
import { Textarea } from '#/renderer/src/components/forms';

/**
 * Pre-filled commit message when the working tree has uncommitted changes.
 */
const DEFAULT_COMMIT_MESSAGE = 'Update HarborClient collections';

interface Props {
  /**
   * Whether the panel is open.
   */
  open: boolean;

  /**
   * Git connection id for source-control operations.
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
   * Called when the panel should close.
   */
  onClose: () => void;

  /**
   * Called after a successful git operation to refresh sidebar status.
   */
  onRefresh: () => void;
}

/**
 * In-app git commit, pull, and push panel for a linked repository.
 */
export function GitSourceControlPanel({
  open,
  connectionId,
  connectionName,
  status,
  onClose,
  onRefresh
}: Props): JSX.Element | null {
  const [messageDraft, setMessageDraft] = useState<{ edited: true; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const confirm = useConfirm();

  const hasUnpushed = status?.syncKnown === true && (status.ahead ?? 0) > 0;
  const defaultMessage = (status?.changedCount ?? 0) > 0 ? DEFAULT_COMMIT_MESSAGE : '';
  const message = messageDraft?.edited === true ? messageDraft.value : defaultMessage;

  /**
   * Loads recent commits when the panel opens.
   */
  useEffect(() => {
    if (!open) {
      return;
    }
    void window.api
      .gitLog(connectionId, 10)
      .then(setLog)
      .catch(() => setLog([]));
  }, [open, connectionId]);

  /**
   * Runs a git action and refreshes status on success.
   *
   * @param action - Async git operation.
   */
  const runGitAction = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await action();
      onRefresh();
      setMessageDraft(null);
      const entries = await window.api.gitLog(connectionId, 10);
      setLog(entries);
    } catch (err) {
      onRefresh();
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Commits local changes, prompting to create the HarborClient subdirectory when missing.
   */
  const handleCommit = async (): Promise<void> => {
    const trimmedMessage = message.trim();
    let createHarborRoot = false;

    if (status?.harborRootExists === false) {
      const confirmed = await confirm({
        title: 'Create HarborClient directory?',
        message: `The subdirectory "${status.harborSubdir}" does not exist in this repository. Create it and continue with the commit?`,
        confirmLabel: 'Create and commit'
      });
      if (!confirmed) {
        return;
      }
      createHarborRoot = true;
    }

    await runGitAction(() =>
      window.api.gitCommit(connectionId, trimmedMessage, createHarborRoot || undefined)
    );
  };

  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      className="w-[32rem]"
      labelledBy="git-source-control-title"
      title={`Source control — ${connectionName}`}
    >
      <div className="flex flex-col gap-4">
        {status != null && (
          <div className="text-[14px] text-text" role="status">
            <p className="m-0">
              Branch: <strong>{status.branch ?? 'unknown'}</strong>
            </p>
            <p className="m-0">
              {status.changedCount} uncommitted change(s)
              {status.conflictCount > 0 ? ` · ${status.conflictCount} conflict(s)` : ''}
              {status.syncKnown
                ? status.ahead > 0 || status.behind > 0
                  ? ` · ${status.ahead} ahead, ${status.behind} behind`
                  : ''
                : status.branch != null
                  ? ' · sync status unknown (fetch to compare with remote)'
                  : ''}
            </p>
            {status.conflictCount > 0 && (
              <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[13px] text-text">
                Merge conflict markers were found in collection or environment JSON files. Open the
                affected files in your editor, resolve <code>conflict markers</code>, then reload or
                pull again.
              </p>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-medium text-text">Commit message</span>
          <Textarea
            className="min-h-[80px]"
            value={message}
            disabled={busy}
            onChange={(event) => setMessageDraft({ edited: true, value: event.target.value })}
          />
        </label>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={busy || !message.trim()}
            onClick={() => void handleCommit()}
          >
            Commit
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            disabled={busy}
            onClick={() => void runGitAction(() => window.api.gitPull(connectionId))}
          >
            Pull
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            disabled={busy}
            aria-label={hasUnpushed ? `Push (${status!.ahead} commit(s) ahead)` : 'Push'}
            onClick={() => void runGitAction(() => window.api.gitPush(connectionId))}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              Push
              {hasUnpushed && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
            </span>
          </Button>
        </div>

        {log.length > 0 && (
          <div className="rounded border border-separator p-3">
            <h3 className="m-0 mb-2 text-[14px] font-medium text-text">Recent commits</h3>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {log.map((entry) => (
                <li key={entry.oid} className="text-[13px] text-muted">
                  <span className="text-text">{entry.message}</span>
                  <span> — {entry.author}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
