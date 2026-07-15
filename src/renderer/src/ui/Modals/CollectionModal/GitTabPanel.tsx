import { Button, FormGroup, Input, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';
import type { StorageConnection } from '#/shared/types';
import { normalizeGitHostKey } from '#/shared/gitUrl';

import { Modal } from '@harborclient/sdk/components';
import {
  GitAuthForm,
  type GitAuthAuthorizedResult
} from '#/renderer/src/ui/Shared/Git/GitAuthForm';

interface Props {
  /**
   * Collection display name entered on the repo phase.
   */
  name: string;

  /**
   * Git connection draft used when creating the collection.
   */
  gitDraft: StorageConnection & { type: 'git' };

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
   * Called when repository fields change.
   */
  onGitDraftChange: (connection: StorageConnection) => void;

  /**
   * Creates the git-backed collection after optional auth and repo initialization.
   */
  onCreate: (options: { initGitRepo: boolean }) => void;

  /**
   * Surfaces repository validation errors on the parent Add collection modal.
   */
  onAuthValidationError: (message: string) => void;
}

/**
 * Git-backed collection creation flow inside the Add collection modal.
 */
export function GitTabPanel({
  name,
  gitDraft,
  busy,
  createAndSave,
  onNameChange,
  onGitDraftChange,
  onCreate,
  onAuthValidationError
}: Props): JSX.Element {
  const repoPathId = useId();
  const subdirId = useId();
  const initRepoId = useId();
  const settings = gitDraft.settings;
  const repoPath = settings.repoPath.trim();
  const gitDraftRef = useRef(gitDraft);
  const pendingRepoPathRef = useRef<string | null>(null);
  const [checkedRepoPath, setCheckedRepoPath] = useState<string | null>(null);
  const [checkedIsRepo, setCheckedIsRepo] = useState<boolean | null>(null);
  const isRepo = repoPath.length === 0 ? null : checkedRepoPath === repoPath ? checkedIsRepo : null;
  const [initGitRepo, setInitGitRepo] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const gitHost = normalizeGitHostKey(settings.url);

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

  /**
   * Tracks whether the current repository path is already a git working tree.
   */
  useEffect(() => {
    if (!repoPath) {
      return;
    }

    let cancelled = false;
    void window.api.gitIsRepo(repoPath).then((value) => {
      if (!cancelled) {
        setCheckedRepoPath(repoPath);
        setCheckedIsRepo(value);
        if (value) {
          setInitGitRepo(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repoPath]);

  /**
   * Returns whether a saved identity exists for the repository host.
   */
  const hostHasIdentity = useCallback(async (): Promise<boolean> => {
    if (!gitHost) {
      return true;
    }
    const identities = await window.api.listGitIdentities();
    return identities.some((identity) => identity.host === gitHost && identity.hasCredentials);
  }, [gitHost]);

  /**
   * Starts collection creation, prompting for host credentials when needed.
   */
  const handleCreateClick = useCallback(async (): Promise<void> => {
    if (!repoPhaseReady) {
      return;
    }

    const hasIdentity = await hostHasIdentity();
    if (!hasIdentity && gitHost) {
      setPendingCreate(true);
      setAuthModalOpen(true);
      return;
    }

    onCreate({ initGitRepo });
  }, [gitHost, hostHasIdentity, initGitRepo, onCreate, repoPhaseReady]);

  /**
   * Completes creation after the user skips authentication for local-only work.
   */
  const handleAuthSkip = (): void => {
    setAuthModalOpen(false);
    if (pendingCreate) {
      setPendingCreate(false);
      onCreate({ initGitRepo });
    }
  };

  /**
   * Builds a polite message when auth succeeded but repository validation failed.
   *
   * @param result - Authorization result from {@link GitAuthForm}.
   */
  const buildAuthValidationMessage = useCallback(
    (result: GitAuthAuthorizedResult): string => {
      const repoUrl = settings.url.trim();
      if (result.repoNotFound) {
        return `GitHub authorization succeeded, but the repository at ${repoUrl || 'the URL you entered'} was not found. Check the repository URL and your access, then try Create again.`;
      }
      return `GitHub authorization succeeded, but the repository could not be verified. Check the repository URL and your access, then try Create again.`;
    },
    [settings.url]
  );

  /**
   * Completes creation after credentials are saved in the auth modal.
   *
   * @param result - Optional validation outcome when credentials were stored but the
   *   remote repository could not be reached.
   */
  const handleAuthAuthorized = (result?: GitAuthAuthorizedResult): void => {
    setAuthModalOpen(false);
    if (pendingCreate) {
      setPendingCreate(false);
      if (result?.validationError) {
        onAuthValidationError(buildAuthValidationMessage(result));
        return;
      }
      onCreate({ initGitRepo });
    }
  };

  return (
    <>
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

        {isRepo === false && repoPath.length > 0 ? (
          <FormGroup
            label="Initialize Git repository"
            htmlFor={initRepoId}
            labelTone="muted"
            description="Create a new git repository in the chosen directory and add the remote URL as origin."
          >
            <label className="flex items-center gap-2 text-[14px] text-text">
              <input
                id={initRepoId}
                type="checkbox"
                className="size-4"
                checked={initGitRepo}
                disabled={busy}
                onChange={(event) => setInitGitRepo(event.target.checked)}
              />
              Initialize Git repository
            </label>
          </FormGroup>
        ) : null}

        <FormGroup
          label="Subdirectory"
          htmlFor={subdirId}
          labelTone="muted"
          description="Optional. Leave blank to store the collection at the repository root."
        >
          <Input
            id={subdirId}
            type="text"
            className="w-full"
            value={settings.subdir}
            disabled={busy}
            placeholder=".harborclient"
            onChange={(event) =>
              onGitDraftChange({
                ...gitDraft,
                settings: { ...settings, subdir: event.target.value }
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
          <Button
            type="button"
            disabled={busy || !repoPhaseReady}
            onClick={() => void handleCreateClick()}
          >
            {busy ? 'Creating…' : createLabel}
          </Button>
        </ModalFooter>
      </div>

      {authModalOpen && gitHost ? (
        <Modal
          onClose={() => {
            setAuthModalOpen(false);
            setPendingCreate(false);
          }}
          className="w-[50rem]"
          labelledBy="git-auth-modal-title"
          title="Git authentication"
          description={`Authorize with ${gitHost} before creating this collection, or skip for local-only work.`}
        >
          <GitAuthForm
            host={gitHost}
            url={settings.url}
            repoPath={settings.repoPath}
            disabled={busy}
            onAuthorized={handleAuthAuthorized}
          />
          <ModalFooter spaced>
            <Button type="button" variant="secondary" disabled={busy} onClick={handleAuthSkip}>
              Skip for now
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </>
  );
}
