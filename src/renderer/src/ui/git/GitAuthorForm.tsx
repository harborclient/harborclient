import { useId, type ChangeEvent, type JSX } from 'react';

interface Props {
  /**
   * Commit author display name.
   */
  name: string;

  /**
   * Commit author email address.
   */
  email: string;

  /**
   * Called when the author name changes.
   */
  onNameChange: (value: string) => void;

  /**
   * Called when the author email changes.
   */
  onEmailChange: (value: string) => void;

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;
}

/**
 * Shared name and email fields for git commit author configuration.
 */
export function GitAuthorForm({
  name,
  email,
  onNameChange,
  onEmailChange,
  disabled = false
}: Props): JSX.Element {
  const nameId = useId();
  const emailId = useId();
  const descriptionId = useId();

  /**
   * Updates the author name from the name input.
   */
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onNameChange(event.target.value);
  };

  /**
   * Updates the author email from the email input.
   */
  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onEmailChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-3">
      <p id={descriptionId} className="m-0 text-muted">
        Name and email stamped on commits created through HarborClient.
      </p>
      <label htmlFor={nameId} className="flex flex-col gap-1 text-[14px] text-text">
        Name
        <input
          id={nameId}
          className="rounded border border-separator bg-surface px-3 py-2 text-[14px] text-text"
          type="text"
          value={name}
          disabled={disabled}
          autoComplete="name"
          aria-describedby={descriptionId}
          onChange={handleNameChange}
        />
      </label>
      <label htmlFor={emailId} className="flex flex-col gap-1 text-[14px] text-text">
        Email
        <input
          id={emailId}
          className="rounded border border-separator bg-surface px-3 py-2 text-[14px] text-text"
          type="email"
          value={email}
          disabled={disabled}
          autoComplete="email"
          aria-describedby={descriptionId}
          onChange={handleEmailChange}
        />
      </label>
    </div>
  );
}
