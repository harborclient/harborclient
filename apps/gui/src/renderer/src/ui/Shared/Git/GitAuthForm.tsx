import { SegmentedTabPanel, SegmentedTabs, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GitIdentity } from '#/shared/types';
import { isGitHubRepositoryUrl } from '#/shared/gitUrl';
import {
  credentialsSavedValidationMessage,
  emptyRemoteCredentialsMessage,
  isGitRepoNotFoundError,
  readOnlyRepoAccessMessage
} from '#/shared/gitHttpErrors';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { formatIpcErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { OAuthAuthPanel } from '#/renderer/src/ui/Tabs/Settings/StorageLocationsSection/GitFields/OAuthAuthPanel';
import { PatAuthPanel } from '#/renderer/src/ui/Tabs/Settings/StorageLocationsSection/GitFields/PatAuthPanel';
import type { AuthView } from '#/renderer/src/ui/Tabs/Settings/StorageLocationsSection/GitFields/types';

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

  /**
   * True when credentials were validated and the remote has no branch refs yet.
   */
  emptyRemote?: boolean;

  /**
   * True when GitHub granted push access; false when credentials are read-only.
   */
  canPush?: boolean;
}

interface Props {
  /**
   * Normalized lowercase git host key.
   */
  host: string;

  /**
   * Repository URL used to decide whether GitHub OAuth is available and to validate.
   */
  url: string;

  /**
   * Optional branch name used when validating credentials against the remote.
   */
  branch?: string;

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
 * Shared git host authentication form for Settings and collection flows.
 */
export function GitAuthForm({
  host,
  url,
  branch,
  disabled = false,
  onAuthorized
}: Props): JSX.Element {
  const confirm = useConfirm();
  const dispatch = useAppDispatch();
  const [identity, setIdentity] = useState<GitIdentity | null>(null);
  const [patUsername, setPatUsername] = useState('token');
  const [patToken, setPatToken] = useState('');
  const [oauthUserCode, setOauthUserCode] = useState<string | null>(null);
  const [oauthVerificationUri, setOauthVerificationUri] = useState<string | null>(null);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>('oauth');
  const patUsernameId = useId();
  const patTokenId = useId();

  const authDisabled = disabled || authBusy;
  const isGitHubUrl = isGitHubRepositoryUrl(url);
  const isAuthorized = identity?.hasCredentials === true;
  const validationBranch = branch?.trim() || 'main';

  /**
   * Shows a blocking alert for git authentication or repository validation failures.
   *
   * @param message - User-facing error body text.
   * @param title - Dialog heading.
   */
  const showAuthAlert = useCallback(
    (message: string, title = 'Git authentication failed'): void => {
      showAlert(dispatch, message, title, { icon: 'warning' });
    },
    [dispatch]
  );

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
   * Applies non-blocking validation status after credentials were stored successfully.
   *
   * @param result - Empty-remote and push-capability flags from validation.
   */
  const applyValidationSuccess = useCallback(
    (result: { emptyRemote?: boolean; canPush?: boolean }): void => {
      if (result.emptyRemote) {
        setAuthInfo(emptyRemoteCredentialsMessage());
      } else {
        setAuthInfo(null);
      }
      if (result.canPush === false) {
        showAuthAlert(readOnlyRepoAccessMessage(), 'Read-only repository access');
      }
      onAuthorized?.({
        emptyRemote: result.emptyRemote,
        canPush: result.canPush
      });
    },
    [onAuthorized, showAuthAlert]
  );

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
      setAuthInfo(null);
      setOauthUserCode(null);
      setOauthVerificationUri(null);
      setOauthWaiting(false);
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
          setOauthVerificationUri(null);
          setAuthView('oauth');
          setOauthWaiting(false);

          if (event.validationError) {
            const repoNotFound = isGitRepoNotFoundError(event.validationError);
            const message = credentialsSavedValidationMessage(event.validationError);
            showAuthAlert(message, 'Repository access denied');
            setAuthInfo(null);
            onAuthorized?.({ validationError: event.validationError, repoNotFound });
            return;
          }

          applyValidationSuccess({
            emptyRemote: event.emptyRemote,
            canPush: event.canPush
          });
          toast.success('GitHub authorization complete.');
        });
        return;
      }

      showAuthAlert(event.error ?? 'GitHub authorization failed.');
      setOauthUserCode(null);
      setOauthVerificationUri(null);
      setAuthInfo(null);
    });
  }, [applyValidationSuccess, host, onAuthorized, reloadIdentity, showAuthAlert]);

  /**
   * Stores a PAT for the host and optionally validates it against the repo URL.
   */
  const handleSavePat = async (): Promise<void> => {
    if (!patToken.trim()) {
      showAuthAlert('Enter a personal access token.');
      return;
    }

    setAuthBusy(true);
    setAuthInfo(null);
    try {
      const result = await window.api.gitSetHostPat(
        host,
        patUsername,
        patToken,
        url.trim() || undefined,
        url.trim() ? validationBranch : undefined
      );
      await reloadIdentity();
      setPatToken('');
      setAuthView('pat');
      applyValidationSuccess(result);
      toast.success('Token saved and validated.');
    } catch (err) {
      const message = formatIpcErrorMessage(err, 'Failed to save token.');
      await reloadIdentity();
      const identities = await window.api.listGitIdentities();
      const updated = identities.find((item) => item.host === host) ?? null;
      if (updated?.hasCredentials && onAuthorized) {
        setPatToken('');
        setAuthView('pat');
        showAuthAlert(credentialsSavedValidationMessage(message), 'Repository access denied');
        onAuthorized({
          validationError: message,
          repoNotFound: isGitRepoNotFoundError(message)
        });
      } else if (updated?.hasCredentials) {
        setPatToken('');
        setAuthView('pat');
        showAuthAlert(credentialsSavedValidationMessage(message), 'Repository access denied');
      } else {
        showAuthAlert(message);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  /**
   * Starts GitHub OAuth device flow and shows the user code without opening the browser yet.
   */
  const handleStartOAuth = async (): Promise<void> => {
    setAuthBusy(true);
    setAuthInfo(null);
    setOauthWaiting(false);
    try {
      const result = await window.api.gitStartHostOAuth(
        host,
        url.trim() || undefined,
        url.trim() ? validationBranch : undefined
      );
      setOauthUserCode(result.userCode);
      setOauthVerificationUri(result.verificationUri);
    } catch (err) {
      showAuthAlert(formatIpcErrorMessage(err, 'Failed to start GitHub authorization.'));
    } finally {
      setAuthBusy(false);
    }
  };

  /**
   * Opens the GitHub verification URI and starts background polling for approval.
   */
  const handleFinishOAuth = async (): Promise<void> => {
    if (!oauthVerificationUri) {
      showAuthAlert('Start GitHub authorization first to get a verification code.');
      return;
    }

    setAuthBusy(true);
    setAuthInfo(null);
    try {
      await window.api.gitCompleteHostOAuth(
        host,
        oauthVerificationUri,
        url.trim() || undefined,
        url.trim() ? validationBranch : undefined
      );
      setOauthWaiting(true);
    } catch (err) {
      showAuthAlert(formatIpcErrorMessage(err, 'Failed to open GitHub authorization.'));
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
    setAuthInfo(null);
    try {
      await window.api.gitRevokeHost(host);
      await reloadIdentity();
      setOauthUserCode(null);
      setOauthVerificationUri(null);
      setOauthWaiting(false);
      setAuthView('oauth');
      toast.success('Git credentials revoked.');
      onAuthorized?.();
    } catch (err) {
      showAuthAlert(formatIpcErrorMessage(err, 'Failed to revoke git credentials.'));
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
              onFinish={() => void handleFinishOAuth()}
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

      {authInfo ? (
        <p className="m-0 text-text text-center" role="status">
          {authInfo}
        </p>
      ) : null}

      {isAuthorized && !authInfo ? (
        <p className="m-0 text-text" role="status">
          Credentials saved for {host}
          {identity?.githubLogin ? ` (signed in as ${identity.githubLogin})` : ''}.
        </p>
      ) : null}
    </div>
  );
}
