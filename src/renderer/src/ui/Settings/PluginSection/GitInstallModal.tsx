import type { JSX, KeyboardEvent } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { FormGroup } from '#/renderer/src/components/FormGroup';
import { Input } from '#/renderer/src/components/forms';
import { Modal, ModalFormLayout } from '#/renderer/src/components/Modal';
import { FieldError } from '#/renderer/src/components/FieldError';

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
    <Modal
      onClose={onClose}
      labelledBy="plugin-git-install-title"
      title="Install from Git"
      description={
        <>
          Enter a public repository URL. The repo must include a built{' '}
          <code className="text-text">manifest.json</code> and entry files at the repository root.
        </>
      }
      closeDisabled={busy}
      disableEscape={busy}
    >
      <ModalFormLayout
        error={
          error ? (
            <FieldError spacing="section" roleAlert>
              {error}
            </FieldError>
          ) : null
        }
        actions={
          <Button type="button" disabled={busy || !url.trim()} onClick={onInstall}>
            {busy ? 'Cloning…' : 'Install'}
          </Button>
        }
      >
        <FormGroup label="Repository URL" htmlFor="plugin-git-install-url" labelTone="muted">
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
        </FormGroup>
        <FormGroup
          label="Branch or tag (optional)"
          htmlFor="plugin-git-install-ref"
          labelTone="muted"
        >
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
        </FormGroup>
      </ModalFormLayout>
    </Modal>
  );
}
