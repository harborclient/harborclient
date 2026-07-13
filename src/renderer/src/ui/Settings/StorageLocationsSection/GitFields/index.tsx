import {
  Button,
  FormGroup,
  SegmentedTabPanel,
  SegmentedTabs,
  SegmentedTabsGroup,
  Input
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { StorageConnection, GitSettings } from '#/shared/types';
import { isGitHubRepositoryUrl } from '#/shared/gitUrl';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';

import { OAuthAuthPanel } from './OAuthAuthPanel';
import { PatAuthPanel } from './PatAuthPanel';
import type { AuthView } from './types';

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
}

/**
 * Git repository connection fields for database settings.
 */
export function GitFields({ connection, disabled = false, onChange }: Props): JSX.Element {
  const settings = connection.settings;
  const confirm = useConfirm();
  const [patUsername, setPatUsername] = useState(
    settings.auth.kind === 'pat' ? settings.auth.username : 'token'
  );
  const [patToken, setPatToken] = useState('');
  const [oauthUserCode, setOauthUserCode] = useState<string | null>(null);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(
    settings.auth.kind === 'oauth' ? 'oauth' : 'pat'
  );
  const patUsernameId = useId();
  const patTokenId = useId();
  const oauthClientIdId = useId();
  const repoPathId = useId();
  const connectionRef = useRef(connection);
  const pendingRepoPathRef = useRef<string | null>(null);

  /**
   * Keeps the latest connection draft available for async repo-path autofill callbacks.
   */
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const authDisabled = disabled || authBusy;
  const isGitHubUrl = isGitHubRepositoryUrl(settings.url);

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
   * Refreshes auth metadata in the editor from the main-process connection store.
   * Credential IPC handlers persist auth on disk; the renderer must not construct
   * parallel auth values.
   */
  const reloadAuthFromMain = useCallback(async (): Promise<void> => {
    if (!connection.id) {
      return;
    }

    const connections = await window.api.listStorageConnections();
    const updated = connections.find((item) => item.id === connection.id);
    if (updated?.type !== 'git') {
      return;
    }

    updateSettings({ auth: updated.settings.auth });
    if (updated.settings.auth.kind === 'pat') {
      setPatUsername(updated.settings.auth.username);
    }
  }, [connection.id, updateSettings]);

  /**
   * Applies OAuth completion events from the main-process background poller.
   */
  useEffect(() => {
    if (!connection.id) {
      return;
    }

    return window.api.onGitOAuthFinished((event) => {
      if (event.connectionId !== connection.id) {
        return;
      }

      setOauthWaiting(false);

      if (event.ok) {
        void reloadAuthFromMain().then(() => {
          setOauthUserCode(null);
          setAuthView('oauth');
          toast.success('GitHub authorization complete.');
        });
        return;
      }

      toast.error(event.error ?? 'GitHub authorization failed.');
    });
  }, [connection.id, reloadAuthFromMain]);

  /**
   * Stores a PAT and validates remote credentials.
   */
  const handleSavePat = async (): Promise<void> => {
    if (!connection.id) {
      toast.error('Save the connection first, then enter a token.');
      return;
    }
    if (!patToken.trim()) {
      toast.error('Enter a personal access token.');
      return;
    }
    setAuthBusy(true);
    try {
      await window.api.gitSetPat(connection.id, patUsername, patToken);
      await reloadAuthFromMain();
      setPatToken('');
      setAuthView('pat');
      toast.success('Token saved and validated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

  /**
   * Starts GitHub OAuth device flow in the browser.
   */
  const handleStartOAuth = async (): Promise<void> => {
    if (!connection.id) {
      toast.error('Save the connection first, then authorize with GitHub.');
      return;
    }
    setAuthBusy(true);
    try {
      const result = await window.api.gitStartOAuth(connection.id);
      setOauthUserCode(result.userCode);
      setOauthWaiting(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

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
   * Revokes stored GitHub OAuth credentials after user confirmation.
   */
  const handleRevokeOAuth = async (): Promise<void> => {
    if (!connection.id) {
      return;
    }

    const confirmed = await confirm({
      title: 'Revoke GitHub authorization',
      message:
        'HarborClient will remove the stored GitHub OAuth tokens. Push, pull, and fetch will fail until you authorize again or enter a personal access token.',
      confirmLabel: 'Revoke authorization',
      variant: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setAuthBusy(true);
    try {
      await window.api.gitRevokeOAuth(connection.id);
      await reloadAuthFromMain();
      setOauthUserCode(null);
      setOauthWaiting(false);
      setAuthView('pat');
      toast.success('GitHub authorization revoked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const patPanel = (
    <PatAuthPanel
      usernameId={patUsernameId}
      tokenId={patTokenId}
      patUsername={patUsername}
      patToken={patToken}
      disabled={authDisabled}
      onUsernameChange={setPatUsername}
      onTokenChange={setPatToken}
      onSave={() => void handleSavePat()}
    />
  );

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
          onChange={(event) => updateSettings({ subdir: event.target.value })}
        />
      </FormGroup>

      <div className="flex flex-col gap-3 rounded border border-separator p-3">
        <span className="text-[14px] font-medium text-text">Authentication</span>

        {isGitHubUrl ? (
          <SegmentedTabsGroup
            value={authView}
            onChange={setAuthView}
            ariaLabel="Git authentication method"
          >
            <SegmentedTabs
              pattern="radiogroup"
              fullWidth
              tabs={[
                {
                  value: 'oauth',
                  label: 'GitHub OAuth',
                  indicator: settings.auth.kind === 'oauth'
                },
                {
                  value: 'pat',
                  label: 'Personal access token',
                  indicator: settings.auth.kind === 'pat'
                }
              ]}
            />
            <SegmentedTabPanel value="oauth" className="pt-2">
              <OAuthAuthPanel
                isAuthorized={settings.auth.kind === 'oauth'}
                disabled={authDisabled}
                oauthUserCode={oauthUserCode}
                oauthWaiting={oauthWaiting}
                onStart={() => void handleStartOAuth()}
                onRevoke={() => void handleRevokeOAuth()}
              />
            </SegmentedTabPanel>
            <SegmentedTabPanel value="pat" className="pt-2">
              {patPanel}
            </SegmentedTabPanel>
          </SegmentedTabsGroup>
        ) : (
          <>
            <p className="m-0 text-[13px] text-muted">
              GitHub OAuth is available when the repository URL is on github.com.
            </p>
            {patPanel}
          </>
        )}
      </div>

      <details className="rounded border border-separator p-3">
        <summary className="text-[14px] font-medium text-text cursor-pointer">Advanced</summary>
        <FormGroup
          label="GitHub OAuth Client ID"
          htmlFor={oauthClientIdId}
          labelTone="muted"
          className="mt-3"
          description={
            <>
              Use your organization&apos;s GitHub OAuth App (device flow enabled, <code>repo</code>{' '}
              scope). Changing this after authorizing requires revoking and re-authorizing.
            </>
          }
        >
          <Input
            id={oauthClientIdId}
            type="text"
            value={settings.oauthClientId ?? ''}
            disabled={disabled}
            placeholder="Leave blank to use HarborClient's app"
            onChange={(event) => updateSettings({ oauthClientId: event.target.value })}
          />
        </FormGroup>
      </details>
    </div>
  );
}
