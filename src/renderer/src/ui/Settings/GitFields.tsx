import { useId, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { DatabaseConnection, GitSettings } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import {
  SegmentedTabPanel,
  SegmentedTabs,
  SegmentedTabsGroup
} from '#/renderer/src/components/SegmentedTabs';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { field } from '#/renderer/src/ui/shared/classes';

type AuthView = 'oauth' | 'pat';

interface Props {
  /**
   * Git connection being edited.
   */
  connection: DatabaseConnection & { type: 'git' };

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;

  /**
   * Called when settings change.
   */
  onChange: (connection: DatabaseConnection) => void;
}

interface PatAuthPanelProps {
  /**
   * DOM id for the username input.
   */
  usernameId: string;

  /**
   * DOM id for the token input.
   */
  tokenId: string;

  /**
   * Username for Basic Auth.
   */
  patUsername: string;

  /**
   * PAT value being entered (not persisted until save).
   */
  patToken: string;

  /**
   * Whether inputs and actions are disabled.
   */
  disabled: boolean;

  /**
   * Called when the username changes.
   */
  onUsernameChange: (value: string) => void;

  /**
   * Called when the token changes.
   */
  onTokenChange: (value: string) => void;

  /**
   * Called when the user saves the PAT.
   */
  onSave: () => void;
}

/**
 * Personal access token authentication fields shared by tab and non-GitHub layouts.
 */
function PatAuthPanel({
  usernameId,
  tokenId,
  patUsername,
  patToken,
  disabled,
  onUsernameChange,
  onTokenChange,
  onSave
}: PatAuthPanelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1" htmlFor={usernameId}>
        <span className="text-[13px] text-muted">Username</span>
        <input
          id={usernameId}
          type="text"
          className={field}
          value={patUsername}
          disabled={disabled}
          onChange={(event) => onUsernameChange(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 mb-2" htmlFor={tokenId}>
        <span className="text-[13px] text-muted">Token</span>
        <input
          id={tokenId}
          type="password"
          className={field}
          value={patToken}
          disabled={disabled}
          onChange={(event) => onTokenChange(event.target.value)}
        />
      </label>
      <Button variant="primary" disabled={disabled} onClick={onSave}>
        Save token
      </Button>
    </div>
  );
}

interface OAuthAuthPanelProps {
  /**
   * Whether GitHub OAuth credentials are stored for this connection.
   */
  isAuthorized: boolean;

  /**
   * Whether inputs and actions are disabled.
   */
  disabled: boolean;

  /**
   * Device-flow user code shown after starting OAuth, if any.
   */
  oauthUserCode: string | null;

  /**
   * Called when the user starts GitHub OAuth.
   */
  onStart: () => void;

  /**
   * Called when the user completes GitHub OAuth after approving in a browser.
   */
  onComplete: () => void;

  /**
   * Called when the user revokes stored GitHub OAuth credentials.
   */
  onRevoke: () => void;
}

/**
 * GitHub OAuth device-flow controls.
 */
function OAuthAuthPanel({
  isAuthorized,
  disabled,
  oauthUserCode,
  onStart,
  onComplete,
  onRevoke
}: OAuthAuthPanelProps): JSX.Element {
  if (isAuthorized) {
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[13px] text-text" role="status">
          Authorized with GitHub.
        </p>
        <Button variant="secondaryDanger" disabled={disabled} onClick={onRevoke}>
          Revoke GitHub authorization
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] text-muted">Sign in via browser; no token to copy.</p>
      <Button disabled={disabled} onClick={onStart}>
        Authorize with GitHub
      </Button>
      {oauthUserCode != null && (
        <p className="m-0 text-[13px] text-text">
          Enter code <strong>{oauthUserCode}</strong> in the browser, then click Complete
          authorization.
        </p>
      )}
      {oauthUserCode != null && (
        <Button variant="secondary" disabled={disabled} onClick={onComplete}>
          Complete authorization
        </Button>
      )}
    </div>
  );
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
  const [authBusy, setAuthBusy] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(
    settings.auth.kind === 'oauth' ? 'oauth' : 'pat'
  );
  const patUsernameId = useId();
  const patTokenId = useId();
  const oauthClientIdId = useId();

  const authDisabled = disabled || authBusy;
  const isGitHubUrl = settings.url.includes('github.com');

  /**
   * Updates a git settings field on the parent connection.
   *
   * @param partial - Partial settings patch.
   */
  const updateSettings = (partial: Partial<GitSettings>): void => {
    onChange({
      ...connection,
      settings: { ...settings, ...partial }
    });
  };

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
      updateSettings({ auth: { kind: 'pat', username: patUsername.trim() || 'token' } });
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

  /**
   * Completes GitHub OAuth after the user approves in a browser.
   */
  const handleCompleteOAuth = async (): Promise<void> => {
    if (!connection.id) {
      return;
    }
    setAuthBusy(true);
    try {
      await window.api.gitCompleteOAuth(connection.id);
      updateSettings({ auth: { kind: 'oauth', provider: 'github' } });
      setOauthUserCode(null);
      setAuthView('oauth');
      toast.success('GitHub authorization complete.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
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
      updateSettings({ auth: { kind: 'pat', username: 'token' } });
      setOauthUserCode(null);
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
      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Repository path</span>
        <input
          type="text"
          className={field}
          value={settings.repoPath}
          disabled={disabled}
          placeholder="/path/to/your/repo"
          onChange={(event) => updateSettings({ repoPath: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Repository URL (HTTPS)</span>
        <input
          type="url"
          className={field}
          value={settings.url}
          disabled={disabled}
          placeholder="https://github.com/org/repo.git"
          onChange={(event) => updateSettings({ url: event.target.value })}
        />
        <span className="text-[13px] text-muted">
          SSH remotes are not supported; use an HTTPS URL and a token or GitHub OAuth.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Branch</span>
        <input
          type="text"
          className={field}
          value={settings.branch}
          disabled={disabled}
          onChange={(event) => updateSettings({ branch: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">HarborClient subdirectory</span>
        <input
          type="text"
          className={field}
          value={settings.subdir}
          disabled={disabled}
          onChange={(event) => updateSettings({ subdir: event.target.value })}
        />
      </label>

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
                onStart={() => void handleStartOAuth()}
                onComplete={() => void handleCompleteOAuth()}
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
        <label className="flex flex-col gap-1 mt-3" htmlFor={oauthClientIdId}>
          <span className="text-[13px] text-muted">GitHub OAuth Client ID</span>
          <input
            id={oauthClientIdId}
            type="text"
            className={field}
            value={settings.oauthClientId ?? ''}
            disabled={disabled}
            placeholder="Leave blank to use HarborClient's app"
            onChange={(event) => updateSettings({ oauthClientId: event.target.value })}
          />
          <span className="text-[13px] text-muted">
            Use your organization&apos;s GitHub OAuth App (device flow enabled, <code>repo</code>{' '}
            scope). Changing this after authorizing requires revoking and re-authorizing.
          </span>
        </label>
      </details>
    </div>
  );
}
