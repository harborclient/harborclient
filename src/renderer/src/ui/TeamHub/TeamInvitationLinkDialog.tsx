import { Textarea, Button, FormGroup, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';

interface Props {
  /**
   * Dialog title shown above the invitation link.
   */
  title: string;

  /**
   * Explanatory text describing how the invitee should use the link.
   */
  description: string;

  /**
   * harborclient:// join deep link to copy and share.
   */
  joinLink: string;

  /**
   * Closes the dialog after the operator copies or acknowledges the link.
   */
  onClose: () => void;
}

/**
 * Modal that displays a one-time Team Hub invitation join link with copy support.
 */
export function TeamInvitationLinkDialog({
  title,
  description,
  joinLink,
  onClose
}: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  /**
   * Copies the invitation join link to the clipboard and shows brief confirmation.
   */
  const handleCopy = (): void => {
    void navigator.clipboard.writeText(joinLink).then(() => {
      setCopied(true);
    });
  };

  return (
    <Modal
      className="w-[560px]"
      overlayClassName="z-[60]"
      labelledBy="team-invitation-link-dialog-title"
      onClose={onClose}
      title={title}
      description={description}
    >
      <FormGroup label="Invitation link" htmlFor="team-invitation-link-value">
        <Textarea
          id="team-invitation-link-value"
          readOnly
          variant="surface"
          className="h-24 resize-none font-mono text-[14px]"
          value={joinLink}
        />
      </FormGroup>

      <ModalFooter spaced>
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
