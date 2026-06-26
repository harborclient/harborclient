import type { JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';

interface Props {
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
   * Whether background OAuth polling is waiting for browser approval.
   */
  oauthWaiting: boolean;

  /**
   * Called when the user starts GitHub OAuth.
   */
  onStart: () => void;

  /**
   * Called when the user revokes stored GitHub OAuth credentials.
   */
  onRevoke: () => void;
}

/**
 * GitHub OAuth device-flow controls.
 */
export function OAuthAuthPanel({
  isAuthorized,
  disabled,
  oauthUserCode,
  oauthWaiting,
  onStart,
  onRevoke
}: Props): JSX.Element {
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
          Enter code <strong>{oauthUserCode}</strong> in the browser.
        </p>
      )}
      {oauthWaiting && (
        <p className="m-0 text-[13px] text-text" role="status" aria-live="polite">
          Waiting for approval in your browser…
        </p>
      )}
    </div>
  );
}
