import { Button, FormGroup, Textarea, FaIcon } from '@harborclient/sdk/components';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { getAvailableModels } from '#/shared/ai/models';
import {
  canReplaceGitCommitMessage,
  DEFAULT_GIT_COMMIT_MESSAGE
} from '#/shared/ai/gitCommitMessage';
import type { SourceControlStatus } from '#/shared/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { store } from '#/renderer/src/store/redux';
import {
  selectGithubModelsConnected,
  selectHubModelGroups,
  selectSelectedModelByChat
} from '#/renderer/src/store/slices/aiChatSlice';
import { runGitCommitMessage } from '#/renderer/src/git/runGitCommitMessage';
import { resolveGitCommitMessageModelId } from '#/renderer/src/git/gitCommitMessageModel';
import { faStop, faWandMagicSparkles } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Git connection id for commit operations.
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
   * Called after a successful git operation to refresh sidebar status.
   */
  onRefresh: () => void;
}

/**
 * Commit message textarea and commit action for the Git sidebar.
 */
export function GitCommitMessageSection({
  connectionId,
  connectionName,
  collectionUuid,
  status,
  onRefresh
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const hubModelGroups = useAppSelector(selectHubModelGroups);
  const githubConnected = useAppSelector(selectGithubModelsConnected);
  const selectedModelByChat = useAppSelector(selectSelectedModelByChat);
  const gitAutoAdd = useAppSelector((state) => state.settings.general.gitAutoAdd);
  const { aiAvailable, aiSettings } = useAiAvailability();
  const [messageDraft, setMessageDraft] = useState<{ edited: true; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const confirm = useConfirm();
  const stepRequestIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const messageRef = useRef('');

  const hasUncommittedChanges = (status?.changedCount ?? 0) > 0;
  const hasCommitChanges = gitAutoAdd ? hasUncommittedChanges : (status?.stagedCount ?? 0) > 0;
  const defaultMessage = hasCommitChanges ? DEFAULT_GIT_COMMIT_MESSAGE : '';
  const message =
    messageDraft?.edited === true && !canReplaceGitCommitMessage(messageDraft.value)
      ? messageDraft.value
      : defaultMessage;
  const availableModels = getAvailableModels(aiSettings, hubModelGroups, githubConnected);
  const preferredChatModelId = Object.values(selectedModelByChat)[0];
  const commitMessageModelId = resolveGitCommitMessageModelId(
    availableModels,
    preferredChatModelId
  );
  const canGenerateMessage =
    aiAvailable && commitMessageModelId.length > 0 && hasUncommittedChanges && !busy;

  /**
   * Keeps the latest textarea value available to async generation completion handlers.
   */
  useEffect(() => {
    messageRef.current = message;
  }, [message]);

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

    setBusy(true);
    try {
      await window.api.gitCommit(connectionId, trimmedMessage, createHarborRoot || undefined);
      onRefresh();
      setMessageDraft(null);
    } catch (err) {
      onRefresh();
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
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
        githubConnected,
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
    githubConnected,
    hubModelGroups
  ]);

  return (
    <div className="flex flex-col gap-3 px-2 pb-2">
      <FormGroup label="" className="p-0! border-none! mt-1">
        <div className="relative w-full">
          <Textarea
            className="block min-h-[80px] w-full pr-12"
            value={message}
            disabled={busy || generatingMessage}
            onChange={(event) => setMessageDraft({ edited: true, value: event.target.value })}
          />
          {aiAvailable ? (
            <Button
              type="button"
              variant="icon"
              className="absolute right-4 top-2 z-10 h-8 w-8 min-h-8 min-w-8 p-0"
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

        {generateError ? (
          <p className="mt-2 text-[14px] text-danger" role="alert">
            {generateError}
          </p>
        ) : null}
      </FormGroup>

      <Button
        className="w-full"
        disabled={busy || generatingMessage || !message.trim() || !hasCommitChanges}
        onClick={() => void handleCommit()}
      >
        {generatingMessage ? 'Generating commit message' : 'Commit'}
      </Button>
    </div>
  );
}
