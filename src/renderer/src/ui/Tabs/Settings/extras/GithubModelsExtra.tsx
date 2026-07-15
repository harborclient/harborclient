import { SettingSectionHeading } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { OAuthAuthPanel } from '#/renderer/src/ui/Tabs/Settings/StorageLocationsSection/GitFields/OAuthAuthPanel';
import { useGithubModelsAuth } from '#/renderer/src/hooks/useGithubModelsAuth';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';

/**
 * GitHub Models sign-in section rendered under the AI API key fields.
 */
export function GithubModelsExtra(): JSX.Element {
  const confirm = useConfirm();
  const { status, userCode, waiting, busy, error, start, finish, signOut } = useGithubModelsAuth();
  const disabled = busy;

  /**
   * Revokes GitHub Models credentials after user confirmation.
   */
  const handleSignOut = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Sign out of GitHub Models',
      message:
        'HarborClient will remove your GitHub Models credentials. AI features that rely on GitHub Models will stop working until you sign in again.',
      confirmLabel: 'Sign out',
      variant: 'danger'
    });

    if (!confirmed) {
      return;
    }

    await signOut();
  };

  return (
    <section className="border border-separator p-3 rounded-md">
      <SettingSectionHeading
        settingId="ai.githubModels"
        title="GitHub Models"
        description={
          "Use your GitHub account for AI models. Free GitHub accounts receive rate-limited GitHub Models usage on your account's quota, separate from git storage sign-in."
        }
      />

      {status.connected && status.login ? (
        <p className="m-0 mb-3 text-text" role="status">
          Signed in as @{status.login}
        </p>
      ) : null}

      <OAuthAuthPanel
        isAuthorized={status.connected}
        disabled={disabled}
        oauthUserCode={userCode}
        oauthWaiting={waiting}
        onStart={() => void start()}
        onFinish={() => void finish()}
        onRevoke={() => void handleSignOut()}
        startLabel="GitHub sign-in"
        authorizedLabel="Signed in with GitHub Models."
        revokeLabel="Sign out"
      />

      {error ? (
        <p className="m-0 mt-3 text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
