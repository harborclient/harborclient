import { SegmentedTabPanel, SegmentedTabs, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GitIdentity } from '#/shared/types';
import { isGitHubRepositoryUrl } from '#/shared/gitUrl';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { OAuthAuthPanel } from '#/renderer/src/ui/Settings/StorageLocationsSection/GitFields/OAuthAuthPanel';
import { PatAuthPanel } from '#/renderer/src/ui/Settings/StorageLocationsSection/GitFields/PatAuthPanel';
import type { AuthView } from '#/renderer/src/ui/Settings/StorageLocationsSection/GitFields/types';

/**
 * Result passed to {@link Props.onAuthorized} after credentials are stored.
 */
export interface GitAuthAuthorizedResult {
  /**
   * Error message when credentials were saved but repository validation failed.
   */
  validationError?: string;

  /**
   * Whether the validation error indicates the remote repository was not found.
   */
  repoNotFound?: boolean;
}

interface Props {
  /**
   * Normalized lowercase git host key.
   */
  host: string;

  /**
   * Repository URL used to decide whether GitHub OAuth is available.
   */
  url: string;

  /**
   * Optional local repository path used when validating credentials.
   */
  repoPath?: string;

  /**
   * Whether inputs and actions are disabled.
   */
  disabled?: boolean;

  /**
   * Called after credentials are saved or revoked successfully.
   */
  onAuthorized?: (result?: GitAuthAuthorizedResult) => void;
}

/**
 * Returns whether an error message indicates the remote repository was not found.
 *
 * @param message - Error message from git validation.
 */
function isRepoNotFoundError(message: string): boolean {
  return /\b404\b/i.test(message) || /not found/i.test(message);
}

/**
 * Builds a user-facing message when credentials were saved but validation failed.
 *
 * @param validationError - Raw validation error from the main process.
 */
function credentialsSavedValidationMessage(validationError: string): string {
  if (isRepoNotFoundError(validationError)) {
    return 'Credentials saved, but the repository URL was not found. Check the URL and try again.';
  }
  return 'Credentials saved, but the repository could not be verified. Check the URL and try again.';
}

/**
 * Shared git host authentication form for Settings and collection flows.
 */
export function GitAuthForm({
  host,
  url,
  repoPath,
  disabled = false,
  onAuthorized
}: Props): JSX.Element {
  const confirm = useConfirm();
  const [identity, setIdentity] = useState<GitIdentity | null>(null);
  const [patUsername, setPatUsername] = useState('token');
  const [patToken, setPatToken] = useState('');
  const [oauthUserCode, setOauthUserCode] = useState<string | null>(null);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>('pat');
  const patUsernameId = useId();
  const patTokenId = useId();

  const authDisabled = disabled || authBusy;
  const isGitHubUrl = isGitHubRepositoryUrl(url);
  const isAuthorized = identity?.hasCredentials === true;

  /**
   * Reloads identity metadata for the current host from the main process.
   */
  const reloadIdentity = useCallback(async (): Promise<void> => {
    const identities = await window.api.listGitIdentities();
    const updated = identities.find((item) => item.host === host) ?? null;
    setIdentity(updated);
    if (updated?.auth.kind === 'pat') {
      setPatUsername(updated.auth.username);
      setAuthView('pat');
    } else if (updated?.auth.kind === 'oauth') {
      setAuthView('oauth');
    }
  }, [host]);

  /**
   * Loads identity metadata when the host changes.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const identities = await window.api.listGitIdentities();
      if (cancelled) {
        return;
      }

      const updated = identities.find((item) => item.host === host) ?? null;
      setIdentity(updated);
      setAuthError(null);
      if (updated?.auth.kind === 'pat') {
        setPatUsername(updated.auth.username);
        setAuthView('pat');
      } else if (updated?.auth.kind === 'oauth') {
        setAuthView('oauth');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [host]);

  /**
   * Applies OAuth completion events from the main-process background poller.
   */
  useEffect(() => {
    return window.api.onGitOAuthFinished((event) => {
      if (event.host !== host) {
        return;
      }

      setOauthWaiting(false);

      if (event.ok) {
        void reloadIdentity().then(() => {
          setOauthUserCode(null);
          setAuthView('oauth');
          setOauthWaiting(false);

          if (event.validationError) {
            const repoNotFound = isRepoNotFoundError(event.validationError);
            const message = credentialsSavedValidationMessage(event.validationError);
            if (onAuthorized) {
              setAuthError(message);
              onAuthorized({ validationError: event.validationError, repoNotFound });
            } else {
              setAuthError(message);
            }
            return;
          }

          setAuthError(null);
          toast.success('GitHub authorization complete.');
          onAuthorized?.();
        });
        return;
      }

      setAuthError(event.error ?? 'GitHub authorization failed.');
    });
  }, [host, onAuthorized, reloadIdentity]);

  /**
   * Stores a PAT for the host and optionally validates it against the repo URL.
   */
  const handleSavePat = async (): Promise<void> => {
    if (!patToken.trim()) {
      setAuthError('Enter a personal access token.');
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      await window.api.gitSetHostPat(
        host,
        patUsername,
        patToken,
        url.trim() || undefined,
        repoPath?.trim() || undefined
      );
      await reloadIdentity();
      setPatToken('');
      setAuthView('pat');
      toast.success('Token saved and validated.');
      onAuthorized?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await reloadIdentity();
      const identities = await window.api.listGitIdentities();
      const updated = identities.find((item) => item.host === host) ?? null;
      if (updated?.hasCredentials && onAuthorized) {
        setPatToken('');
        setAuthView('pat');
        setAuthError(credentialsSavedValidationMessage(message));
        onAuthorized({
          validationError: message,
          repoNotFound: isRepoNotFoundError(message)
        });
      } else {
        setAuthError(message);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  /**
   * Starts GitHub OAuth device flow in the browser.
   */
  const handleStartOAuth = async (): Promise<void> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = await window.api.gitStartHostOAuth(
        host,
        url.trim() || undefined,
        repoPath?.trim() || undefined
      );
      setOauthUserCode(result.userCode);
      setOauthWaiting(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

  /**
   * Revokes stored credentials for the host after user confirmation.
   */
  const handleRevoke = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Revoke git credentials',
      message:
        'HarborClient will remove stored credentials for this host. Push, pull, and fetch will fail for all git-backed collections using this host until you authorize again or enter a personal access token.',
      confirmLabel: 'Revoke credentials',
      variant: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      await window.api.gitRevokeHost(host);
      await reloadIdentity();
      setOauthUserCode(null);
      setOauthWaiting(false);
      setAuthView('pat');
      toast.success('Git credentials revoked.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
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
    <div className="flex flex-col gap-3">
      {isGitHubUrl ? (
        <SegmentedTabsGroup
          value={authView}
          onChange={setAuthView}
          ariaLabel="Git authentication method"
        >
          <SegmentedTabs
            pattern="radiogroup"
            editable={false}
            fullWidth
            tabs={[
              {
                value: 'oauth',
                label: 'GitHub OAuth',
                indicator: identity?.auth.kind === 'oauth'
              },
              {
                value: 'pat',
                label: 'Personal access token',
                indicator: identity?.auth.kind === 'pat'
              }
            ]}
          />
          <SegmentedTabPanel value="oauth" className="pt-2">
            <OAuthAuthPanel
              isAuthorized={identity?.auth.kind === 'oauth'}
              disabled={authDisabled}
              oauthUserCode={oauthUserCode}
              oauthWaiting={oauthWaiting}
              onStart={() => void handleStartOAuth()}
              onRevoke={() => void handleRevoke()}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="pat" className="pt-2">
            {patPanel}
          </SegmentedTabPanel>
        </SegmentedTabsGroup>
      ) : (
        <>
          <p className="m-0 text-muted">
            GitHub OAuth is available when the repository URL is on github.com.
          </p>
          {patPanel}
        </>
      )}

      {authError ? (
        <p className="m-0 text-danger text-center" role="alert">
          {authError}
        </p>
      ) : null}

      {isAuthorized ? (
        <p className="m-0 text-text" role="status">
          Credentials saved for {host}.
        </p>
      ) : null}
    </div>
  );
}
