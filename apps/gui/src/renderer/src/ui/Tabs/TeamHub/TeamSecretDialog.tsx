import { Textarea, Button, FormGroup, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';

interface Props {
  /**
   * Dialog title shown above the secret value.
   */
  title: string;

  /**
   * Explanatory text describing why the secret is shown once.
   */
  description: string;

  /**
   * One-time bearer token secret to display.
   */
  secret: string;

  /**
   * Closes the dialog after the operator acknowledges the secret.
   */
  onClose: () => void;
}

/**
 * Modal that displays a one-time API token secret with copy support.
 */
export function TeamSecretDialog({ title, description, secret, onClose }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  /**
   * Copies the token secret to the clipboard and shows brief confirmation.
   */
  const handleCopy = (): void => {
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
    });
  };

  return (
    <Modal
      className="w-[520px]"
      overlayClassName="z-[60]"
      labelledBy="team-secret-dialog-title"
      onClose={onClose}
      title={title}
      description={description}
    >
      <FormGroup label="Token secret" htmlFor="team-secret-value">
        <Textarea
          id="team-secret-value"
          readOnly
          variant="surface"
          className="h-24 resize-none font-mono text-[14px]"
          value={secret}
        />
      </FormGroup>

      <ModalFooter spaced>
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
