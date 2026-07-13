import { Button, FormGroup, Input, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useRef, type JSX } from 'react';
import type { StorageConnection } from '#/shared/types';

import { GitFields } from '#/renderer/src/ui/Settings/StorageLocationsSection/GitFields';

interface Props {
  /**
   * Collection display name entered on the repo phase.
   */
  name: string;

  /**
   * Git connection draft or saved connection used for auth and create.
   */
  gitDraft: StorageConnection & { type: 'git' };

  /**
   * Whether the Git tab is collecting repository details or authentication.
   */
  gitPhase: 'repo' | 'auth';

  /**
   * Whether an async save or create operation is in flight.
   */
  busy: boolean;

  /**
   * When true, the primary action label includes saving the active request.
   */
  createAndSave: boolean;

  /**
   * Updates the collection name field.
   */
  onNameChange: (name: string) => void;

  /**
   * Called when repository or authentication fields change.
   */
  onGitDraftChange: (connection: StorageConnection) => void;

  /**
   * Persists the git connection and advances to the auth phase.
   */
  onContinue: () => void;

  /**
   * Creates the collection in the saved git connection.
   */
  onCreate: () => void;
}

/**
 * Git-backed collection creation flow inside the Add collection modal.
 */
export function GitTabPanel({
  name,
  gitDraft,
  gitPhase,
  busy,
  createAndSave,
  onNameChange,
  onGitDraftChange,
  onContinue,
  onCreate
}: Props): JSX.Element {
  const repoPathId = useId();
  const settings = gitDraft.settings;
  const gitDraftRef = useRef(gitDraft);
  const pendingRepoPathRef = useRef<string | null>(null);

  /**
   * Keeps the latest git draft available for async repo-path autofill callbacks.
   */
  useEffect(() => {
    gitDraftRef.current = gitDraft;
  }, [gitDraft]);

  const repoPhaseReady =
    name.trim().length > 0 && settings.repoPath.trim().length > 0 && settings.url.trim().length > 0;
  const createLabel = createAndSave ? 'Create & Save' : 'Create';

  /**
   * Updates the repository path and auto-fills the HTTPS URL when the chosen path
   * is a git repo with a remote and the URL field is still empty.
   *
   * @param path - Repository path from browse or manual entry.
   */
  const applyRepoPath = useCallback(
    async (path: string): Promise<void> => {
      pendingRepoPathRef.current = path;
      const current = gitDraftRef.current;
      onGitDraftChange({
        ...current,
        settings: { ...current.settings, repoPath: path }
      });

      const remoteUrl = await window.api.gitReadRemoteUrl(path);
      if (pendingRepoPathRef.current !== path) {
        return;
      }

      const latest = gitDraftRef.current;
      if (!remoteUrl?.trim() || latest.settings.url.trim().length > 0) {
        return;
      }

      onGitDraftChange({
        ...latest,
        settings: { ...latest.settings, repoPath: path, url: remoteUrl }
      });
    },
    [onGitDraftChange]
  );

  if (gitPhase === 'auth') {
    return (
      <>
        <p className="mb-4 text-[14px] text-muted">
          Authorize with GitHub or enter a personal access token when the remote requires it. You
          can also skip authentication for local-only work and add credentials later in Collection
          Settings.
        </p>
        <GitFields connection={gitDraft} disabled={busy} onChange={onGitDraftChange} />
        <ModalFooter spaced>
          <Button type="button" disabled={busy || !gitDraft.id} onClick={() => void onCreate()}>
            {busy ? 'Creating…' : createLabel}
          </Button>
        </ModalFooter>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormGroup label="Collection name" labelTone="muted">
        <Input
          className="w-full"
          type="text"
          autoFocus
          value={name}
          disabled={busy}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </FormGroup>

      <FormGroup label="Repository path" htmlFor={repoPathId} labelTone="muted">
        <div className="flex gap-2">
          <Input
            id={repoPathId}
            type="text"
            className="min-w-0 flex-1"
            value={settings.repoPath}
            disabled={busy}
            placeholder="/path/to/your/repo"
            onChange={(event) => {
              void applyRepoPath(event.target.value);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              void window.api.selectDirectory(settings.repoPath).then((selected) => {
                if (selected != null) {
                  void applyRepoPath(selected);
                }
              });
            }}
          >
            Browse
          </Button>
        </div>
      </FormGroup>

      <FormGroup
        label="Repository URL (HTTPS)"
        labelTone="muted"
        description="SSH remotes are not supported; use an HTTPS URL and a token or GitHub OAuth."
      >
        <Input
          type="url"
          className="w-full"
          value={settings.url}
          disabled={busy}
          placeholder="https://github.com/org/repo.git"
          onChange={(event) =>
            onGitDraftChange({
              ...gitDraft,
              settings: { ...settings, url: event.target.value }
            })
          }
        />
      </FormGroup>

      <FormGroup label="Branch" labelTone="muted">
        <Input
          type="text"
          className="w-full"
          value={settings.branch}
          disabled={busy}
          onChange={(event) =>
            onGitDraftChange({
              ...gitDraft,
              settings: { ...settings, branch: event.target.value }
            })
          }
        />
      </FormGroup>

      <ModalFooter spaced>
        <Button type="button" disabled={busy || !repoPhaseReady} onClick={() => void onContinue()}>
          {busy ? 'Saving…' : 'Continue'}
        </Button>
      </ModalFooter>
    </div>
  );
}
