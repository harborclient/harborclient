import { Button, FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

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
      <FormGroup label="Username" htmlFor={usernameId} labelTone="muted">
        <Input
          id={usernameId}
          type="text"
          value={patUsername}
          disabled={disabled}
          onChange={(event) => onUsernameChange(event.target.value)}
        />
      </FormGroup>
      <FormGroup label="Token" htmlFor={tokenId} labelTone="muted" className="mb-2">
        <Input
          id={tokenId}
          type="password"
          value={patToken}
          disabled={disabled}
          onChange={(event) => onTokenChange(event.target.value)}
        />
      </FormGroup>
      <Button variant="primary" disabled={disabled} onClick={onSave}>
        Save token
      </Button>
    </div>
  );
}
