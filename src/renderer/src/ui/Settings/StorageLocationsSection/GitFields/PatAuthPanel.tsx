import type { JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { Input } from '#/renderer/src/components/forms';

interface Props {
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
export function PatAuthPanel({
  usernameId,
  tokenId,
  patUsername,
  patToken,
  disabled,
  onUsernameChange,
  onTokenChange,
  onSave
}: Props): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1" htmlFor={usernameId}>
        <span className="text-[13px] text-muted">Username</span>
        <Input
          id={usernameId}
          type="text"
          value={patUsername}
          disabled={disabled}
          onChange={(event) => onUsernameChange(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 mb-2" htmlFor={tokenId}>
        <span className="text-[13px] text-muted">Token</span>
        <Input
          id={tokenId}
          type="password"
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
