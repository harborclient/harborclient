import { Button, FormGroup, Modal, Textarea, FaIcon } from '@harborclient/sdk/components';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { getAvailableModels } from '#/shared/ai/models';
import {
  canReplaceGitCommitMessage,
  DEFAULT_GIT_COMMIT_MESSAGE
} from '#/shared/ai/gitCommitMessage';
import type { GitLogEntry, SourceControlStatus } from '#/shared/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { store } from '#/renderer/src/store/redux';
import {
  selectHubModelGroups,
  selectSelectedModelByChat
} from '#/renderer/src/store/slices/aiChatSlice';
import { runGitCommitMessage } from '#/renderer/src/git/runGitCommitMessage';
import { resolveGitCommitMessageModelId } from '#/renderer/src/git/gitCommitMessageModel';
import { faStop, faWandMagicSparkles } from '#/renderer/src/fontawesome';

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
   * Collection uuid used to resolve git_diff for AI commit message generation.
   */
  collectionUuid: string;

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
  collectionUuid,
  status,
  onClose,
  onRefresh
}: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const hubModelGroups = useAppSelector(selectHubModelGroups);
  const selectedModelByChat = useAppSelector(selectSelectedModelByChat);
  const { aiAvailable, aiSettings } = useAiAvailability();
  const [messageDraft, setMessageDraft] = useState<{ edited: true; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const confirm = useConfirm();
  const stepRequestIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const messageRef = useRef('');

  const hasUnpushed = status?.syncKnown === true && (status.ahead ?? 0) > 0;
  const defaultMessage = (status?.changedCount ?? 0) > 0 ? DEFAULT_GIT_COMMIT_MESSAGE : '';
  const message = messageDraft?.edited === true ? messageDraft.value : defaultMessage;
  const availableModels = getAvailableModels(aiSettings, hubModelGroups);
  const preferredChatModelId = Object.values(selectedModelByChat)[0];
  const commitMessageModelId = resolveGitCommitMessageModelId(
    availableModels,
    preferredChatModelId
  );
  const canGenerateMessage =
    aiAvailable && commitMessageModelId.length > 0 && (status?.changedCount ?? 0) > 0 && !busy;

  /**
   * Keeps the latest textarea value available to async generation completion handlers.
   */
  useEffect(() => {
    messageRef.current = message;
  }, [message]);

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
   * Cancels in-flight generation and closes the panel.
   */
  const handleClose = useCallback((): void => {
    cancelledRef.current = true;
    if (stepRequestIdRef.current) {
      void window.api.cancelChatStep(stepRequestIdRef.current);
      stepRequestIdRef.current = null;
    }
    setGeneratingMessage(false);
    setGenerateError(null);
    onClose();
  }, [onClose]);

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

  /**
   * Aborts the in-flight commit message generation request.
   */
  const handleStopGenerate = useCallback((): void => {
    if (!generatingMessage || stepRequestIdRef.current == null) {
      return;
    }
    cancelledRef.current = true;
    void window.api.cancelChatStep(stepRequestIdRef.current);
  }, [generatingMessage]);

  /**
   * Generates a commit message from repository diffs when the draft is still replaceable.
   */
  const handleGenerateMessage = useCallback(async (): Promise<void> => {
    if (!canGenerateMessage || generatingMessage) {
      return;
    }

    const snapshotBeforeGenerate = messageRef.current;
    if (!canReplaceGitCommitMessage(snapshotBeforeGenerate)) {
      return;
    }

    setGenerateError(null);
    setGeneratingMessage(true);
    cancelledRef.current = false;
    const stepRequestId = crypto.randomUUID();
    stepRequestIdRef.current = stepRequestId;

    try {
      const generated = await runGitCommitMessage({
        collectionUuid,
        connectionName,
        modelId: commitMessageModelId,
        aiSettings,
        hubModelGroups,
        dispatch,
        getState: store.getState,
        stepRequestId,
        isCancelled: () => cancelledRef.current
      });

      if (cancelledRef.current) {
        return;
      }

      if (!generated) {
        setGenerateError('The model did not return a commit message.');
        return;
      }

      if (!canReplaceGitCommitMessage(messageRef.current)) {
        return;
      }

      setMessageDraft({ edited: true, value: generated });
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to generate a commit message.';
      setGenerateError(errorMessage);
      toast.error(errorMessage);
    } finally {
      stepRequestIdRef.current = null;
      setGeneratingMessage(false);
    }
  }, [
    aiSettings,
    canGenerateMessage,
    collectionUuid,
    commitMessageModelId,
    connectionName,
    dispatch,
    generatingMessage,
    hubModelGroups
  ]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={handleClose}
      className="w-[32rem]"
      labelledBy="git-source-control-title"
      title={`Source control — ${connectionName}`}
    >
      <div className="flex flex-col gap-4">
        {status != null && (
          <div className="text-text" role="status">
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

        <FormGroup label="Commit message" className="p-0! border-none!">
          <div className="relative w-full">
            <Textarea
              className="block min-h-[80px] w-full pr-10"
              value={message}
              disabled={busy || generatingMessage}
              onChange={(event) => setMessageDraft({ edited: true, value: event.target.value })}
            />
            {aiAvailable ? (
              <Button
                type="button"
                variant="icon"
                className="absolute right-2 top-2 z-10 h-8 w-8 min-h-8 min-w-8 p-0"
                disabled={generatingMessage ? false : !canGenerateMessage || busy}
                aria-label={
                  generatingMessage ? 'Stop generating commit message' : 'Generate commit message'
                }
                onClick={() =>
                  generatingMessage ? handleStopGenerate() : void handleGenerateMessage()
                }
              >
                <FaIcon
                  icon={generatingMessage ? faStop : faWandMagicSparkles}
                  className="h-3.5 w-3.5"
                  aria-hidden
                />
              </Button>
            ) : null}
          </div>
          {generatingMessage ? (
            <p className="mt-2 text-[14px] text-muted" role="status">
              Generating commit message…
            </p>
          ) : null}
          {generateError ? (
            <p className="mt-2 text-[14px] text-danger" role="alert">
              {generateError}
            </p>
          ) : null}
        </FormGroup>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={busy || generatingMessage || !message.trim()}
            onClick={() => void handleCommit()}
          >
            Commit
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            disabled={busy || generatingMessage}
            onClick={() => void runGitAction(() => window.api.gitPull(connectionId))}
          >
            Pull
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            disabled={busy || generatingMessage}
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
