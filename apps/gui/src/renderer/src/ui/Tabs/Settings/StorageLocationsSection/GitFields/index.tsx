import { Button, FormGroup, Input } from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';
import type { StorageConnection, GitSettings } from '#/shared/types';
import { normalizeGitHostKey } from '#/shared/gitUrl';
import {
  formatGitHttpError,
  emptyRemoteConnectionTestMessage,
  readOnlyRepoAccessMessage,
  successfulConnectionTestMessage
} from '#/shared/gitHttpErrors';

import { GitAuthForm } from '#/renderer/src/ui/Shared/Git/GitAuthForm';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

interface Props {
  /**
   * Git connection being edited.
   */
  connection: StorageConnection & { type: 'git' };

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;

  /**
   * Called when settings change.
   */
  onChange: (connection: StorageConnection) => void;

  /**
   * Called when the initialize-git-repository checkbox changes.
   */
  onInitGitRepoChange?: (checked: boolean) => void;
}

/**
 * Git repository connection fields for collection settings.
 */
export function GitFields({
  connection,
  disabled = false,
  onChange,
  onInitGitRepoChange
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const settings = connection.settings;
  const repoPathId = useId();
  const initRepoId = useId();
  const repoPath = settings.repoPath.trim();
  const connectionRef = useRef(connection);
  const pendingRepoPathRef = useRef<string | null>(null);
  const [checkedRepoPath, setCheckedRepoPath] = useState<string | null>(null);
  const [checkedIsRepo, setCheckedIsRepo] = useState<boolean | null>(null);
  const isRepo = repoPath.length === 0 ? null : checkedRepoPath === repoPath ? checkedIsRepo : null;
  const [initGitRepo, setInitGitRepo] = useState(false);
  const [hasHostCredentials, setHasHostCredentials] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);
  const gitHost = normalizeGitHostKey(settings.url);

  /**
   * Keeps the latest connection draft available for async repo-path autofill callbacks.
   */
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  /**
   * Reloads whether the current host has stored credentials.
   */
  const reloadHostCredentials = useCallback(async (): Promise<void> => {
    if (!gitHost) {
      setHasHostCredentials(false);
      return;
    }
    const identities = await window.api.listGitIdentities();
    const identity = identities.find((item) => item.host === gitHost);
    setHasHostCredentials(identity?.hasCredentials === true);
  }, [gitHost]);

  /**
   * Loads credential presence when the host key changes.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!gitHost) {
        if (!cancelled) {
          setHasHostCredentials(false);
        }
        return;
      }
      const identities = await window.api.listGitIdentities();
      if (!cancelled) {
        const identity = identities.find((item) => item.host === gitHost);
        setHasHostCredentials(identity?.hasCredentials === true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gitHost]);

  /**
   * Updates a git settings field on the parent connection.
   *
   * @param partial - Partial settings patch.
   */
  const updateSettings = useCallback(
    (partial: Partial<GitSettings>): void => {
      onChange({
        ...connection,
        settings: { ...connection.settings, ...partial }
      });
      setTestSuccessMessage(null);
    },
    [connection, onChange]
  );

  /**
   * Updates the repository path and auto-fills the HTTPS URL when the chosen path
   * is a git repo with a remote and the URL field is still empty.
   *
   * @param path - Repository path from browse or manual entry.
   */
  const applyRepoPath = useCallback(
    async (path: string): Promise<void> => {
      pendingRepoPathRef.current = path;
      const current = connectionRef.current;
      onChange({
        ...current,
        settings: { ...current.settings, repoPath: path }
      });
      setTestSuccessMessage(null);

      const remoteUrl = await window.api.gitReadRemoteUrl(path);
      if (pendingRepoPathRef.current !== path) {
        return;
      }

      const latest = connectionRef.current;
      if (!remoteUrl?.trim() || latest.settings.url.trim().length > 0) {
        return;
      }

      onChange({
        ...latest,
        settings: { ...latest.settings, repoPath: path, url: remoteUrl }
      });
    },
    [onChange]
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
          onInitGitRepoChange?.(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [onInitGitRepoChange, repoPath]);

  /**
   * Opens a native directory picker and updates the repository path when chosen.
   */
  const handleBrowseRepoPath = async (): Promise<void> => {
    const selected = await window.api.selectDirectory(settings.repoPath);
    if (selected != null) {
      await applyRepoPath(selected);
    }
  };

  /**
   * Probes the remote to verify credentials, URL, and push access for this connection.
   */
  const handleTestConnection = async (): Promise<void> => {
    setTestBusy(true);
    setTestSuccessMessage(null);
    try {
      const result = await window.api.gitTestConnection(connection.id);
      if (result.canPush === false) {
        showAlert(dispatch, readOnlyRepoAccessMessage(), 'Read-only repository access', {
          icon: 'warning'
        });
        return;
      }
      setTestSuccessMessage(
        result.emptyRemote ? emptyRemoteConnectionTestMessage() : successfulConnectionTestMessage()
      );
    } catch (err) {
      showAlert(
        dispatch,
        formatGitHttpError(err instanceof Error ? err : String(err), 'validate'),
        'Connection test failed',
        { icon: 'warning' }
      );
    } finally {
      setTestBusy(false);
    }
  };

  const canTestConnection =
    Boolean(gitHost) &&
    settings.url.trim().length > 0 &&
    settings.repoPath.trim().length > 0 &&
    hasHostCredentials &&
    !disabled &&
    !testBusy;

  return (
    <div className="flex flex-col gap-4">
      <FormGroup label="Repository path" htmlFor={repoPathId}>
        <div className="flex gap-2">
          <Input
            id={repoPathId}
            type="text"
            className="min-w-0 flex-1"
            value={settings.repoPath}
            disabled={disabled}
            placeholder="/path/to/your/repo"
            onChange={(event) => {
              void applyRepoPath(event.target.value);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => void handleBrowseRepoPath()}
          >
            Browse
          </Button>
        </div>
      </FormGroup>

      <FormGroup
        label="Repository URL (HTTPS)"
        description="SSH remotes are not supported; use an HTTPS URL and a token or GitHub OAuth."
      >
        <Input
          type="url"
          value={settings.url}
          disabled={disabled}
          placeholder="https://github.com/org/repo.git"
          onChange={(event) => updateSettings({ url: event.target.value })}
        />
      </FormGroup>

      {isRepo === false && repoPath.length > 0 ? (
        <FormGroup
          label="Initialize Git repository"
          htmlFor={initRepoId}
          description="Create a new git repository in the chosen directory and add the remote URL as origin."
        >
          <label className="flex items-center gap-2 text-[14px] text-text">
            <input
              id={initRepoId}
              type="checkbox"
              className="size-4"
              checked={initGitRepo}
              disabled={disabled}
              onChange={(event) => {
                const checked = event.target.checked;
                setInitGitRepo(checked);
                onInitGitRepoChange?.(checked);
              }}
            />
            Initialize Git repository
          </label>
        </FormGroup>
      ) : null}

      <FormGroup label="Branch">
        <Input
          type="text"
          value={settings.branch}
          disabled={disabled}
          onChange={(event) => updateSettings({ branch: event.target.value })}
        />
      </FormGroup>

      <FormGroup label="HarborClient subdirectory">
        <Input
          type="text"
          value={settings.subdir}
          disabled={disabled}
          placeholder=".harborclient"
          onChange={(event) => updateSettings({ subdir: event.target.value })}
        />
      </FormGroup>

      {gitHost ? (
        <div className="flex flex-col gap-3 rounded border border-separator p-3">
          <span className="text-[14px] font-medium text-text">Authentication ({gitHost})</span>
          <GitAuthForm
            host={gitHost}
            url={settings.url}
            branch={settings.branch}
            disabled={disabled}
            onAuthorized={() => {
              void reloadHostCredentials();
              setTestSuccessMessage(null);
            }}
          />
          {hasHostCredentials ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canTestConnection}
                onClick={() => void handleTestConnection()}
              >
                {testBusy ? 'Testing…' : 'Test connection'}
              </Button>
              {testSuccessMessage ? (
                <p className="m-0 text-[14px] text-text" role="status">
                  {testSuccessMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-[14px] text-muted">
          Enter a repository URL to configure authentication for this host.
        </p>
      )}
    </div>
  );
}
