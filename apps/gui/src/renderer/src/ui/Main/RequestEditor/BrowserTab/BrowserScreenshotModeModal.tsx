import { Button, Modal, ModalFooter } from '@harborclient/sdk/components';
import type { JSX } from 'react';

interface Props {
  /**
   * Called when the user dismisses the modal without choosing a mode.
   */
  onClose: () => void;

  /**
   * Called when the user picks a screenshot mode.
   *
   * @param fullPage - True for a full-page scroll-and-stitch capture.
   */
  onChoose: (fullPage: boolean) => void;
}

/**
 * Modal asking whether to capture the visible viewport or the full scrollable page.
 *
 * @param props - Close and choose handlers.
 * @returns Screenshot mode dialog.
 */
export function BrowserScreenshotModeModal({ onClose, onChoose }: Props): JSX.Element {
  return (
    <Modal
      onClose={onClose}
      labelledBy="browser-screenshot-mode-title"
      title="Take screenshot"
      description="Choose how much of the page to capture."
      className="w-[28rem]"
    >
      <ModalFooter spaced>
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={() => onChoose(false)} aria-label="Capture visible area">
          Visible area
        </Button>
        <Button type="button" onClick={() => onChoose(true)} aria-label="Capture full page">
          Full page
        </Button>
      </ModalFooter>
    </Modal>
  );
}
