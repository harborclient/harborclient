import type { JSX, KeyboardEvent } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { Input } from '#/renderer/src/components/forms';
import { Modal } from '#/renderer/src/components/Modal';

interface Props {
  /**
   * Repository URL entered by the user.
   */
  url: string;

  /**
   * Optional git branch or tag.
   */
  ref: string;

  /**
   * Validation or IPC error message shown below the form.
   */
  error: string | null;

  /**
   * Whether a clone operation is in progress.
   */
  busy: boolean;

  /**
   * Updates the repository URL field.
   */
  onUrlChange: (url: string) => void;

  /**
   * Updates the branch or tag field.
   */
  onRefChange: (ref: string) => void;

  /**
   * Closes the modal without installing.
   */
  onClose: () => void;

  /**
   * Starts the install-from-git flow.
   */
  onInstall: () => void;
}

/**
 * Form modal for cloning a plugin from a public git repository URL.
 */
export function GitInstallModal({
  url,
  ref,
  error,
  busy,
  onUrlChange,
  onRefChange,
  onClose,
  onInstall
}: Props): JSX.Element {
  /**
   * Submits the form when Enter is pressed in an input field.
   *
   * @param event - Keyboard event on a form input.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      onInstall();
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="plugin-git-install-title">
      <h2 id="plugin-git-install-title" className="m-0 mb-2 text-[14px] font-semibold text-text">
        Install from Git
      </h2>
      <p className="mb-3 text-[14px] text-muted">
        Enter a public repository URL. The repo must include a built{' '}
        <code className="text-text">manifest.json</code> and entry files at the repository root.
      </p>
      <label htmlFor="plugin-git-install-url" className="mb-1 block text-[14px] text-muted">
        Repository URL
      </label>
      <Input
        id="plugin-git-install-url"
        className="mb-3 w-full"
        type="url"
        autoFocus
        placeholder="https://github.com/example/my-plugin.git"
        value={url}
        disabled={busy}
        onChange={(event) => onUrlChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <label htmlFor="plugin-git-install-ref" className="mb-1 block text-[14px] text-muted">
        Branch or tag (optional)
      </label>
      <Input
        id="plugin-git-install-ref"
        className="w-full"
        type="text"
        placeholder="main"
        value={ref}
        disabled={busy}
        onChange={(event) => onRefChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {error ? (
        <p className="mt-3 text-[14px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={busy || !url.trim()} onClick={onInstall}>
          {busy ? 'Cloning…' : 'Install'}
        </Button>
      </div>
    </Modal>
  );
}
