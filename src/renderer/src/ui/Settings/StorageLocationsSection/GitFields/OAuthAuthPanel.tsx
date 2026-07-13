import { Button, FormGroup, Input } from '@harborclient/sdk/components';
import { useId, useState, type JSX } from 'react';
import toast from 'react-hot-toast';

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
  const oauthUserCodeId = useId();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const codeCopied = copiedCode === oauthUserCode;

  /**
   * Copies the GitHub device-flow user code to the clipboard.
   */
  const handleCopyCode = (): void => {
    if (oauthUserCode == null) {
      return;
    }

    void navigator.clipboard.writeText(oauthUserCode).then(
      () => {
        setCopiedCode(oauthUserCode);
        window.setTimeout(() => {
          setCopiedCode((current) => (current === oauthUserCode ? null : current));
        }, 2000);
      },
      () => {
        toast.error('Failed to copy');
      }
    );
  };

  if (isAuthorized) {
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-text" role="status">
          Authorized with GitHub.
        </p>
        <Button variant="secondary" disabled={disabled} onClick={onRevoke}>
          Revoke GitHub authorization
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[15px] text-muted">Sign in via browser; no token to copy.</p>
      <Button disabled={disabled} onClick={onStart}>
        Authorize with GitHub
      </Button>
      {oauthUserCode != null && (
        <FormGroup label="Enter this code in the browser" htmlFor={oauthUserCodeId}>
          <div className="flex gap-2">
            <Input
              id={oauthUserCodeId}
              type="text"
              readOnly
              className="min-w-0 flex-1 font-mono text-[14px]"
              value={oauthUserCode}
              onFocus={(event) => event.target.select()}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              aria-label="Copy GitHub authorization code"
              onClick={handleCopyCode}
            >
              {codeCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </FormGroup>
      )}
      {oauthWaiting && (
        <p className="m-0 text-[15px] text-text" role="status" aria-live="polite">
          Waiting for approval in your browser…
        </p>
      )}
    </div>
  );
}
