import { Button, Modal, ModalFooter } from '@harborclient/sdk/components';
import type { JSX } from 'react';

interface Props {
  /**
   * Previously saved theme title.
   */
  originalTitle: string;

  /**
   * Title entered in the Creator form.
   */
  newTitle: string;

  /**
   * Whether a save action is in progress.
   */
  busy: boolean;

  /**
   * Renames the existing saved theme in place.
   */
  onUpdateExisting: () => void;

  /**
   * Saves the current draft as a new theme file.
   */
  onSaveAsNew: () => void;

  /**
   * Dismisses the prompt without saving.
   */
  onCancel: () => void;
}

/**
 * Asks whether a renamed custom theme should update the existing file or save as a copy.
 */
export function SaveRenamedThemeModal({
  originalTitle,
  newTitle,
  busy,
  onUpdateExisting,
  onSaveAsNew,
  onCancel
}: Props): JSX.Element {
  return (
    <Modal
      onClose={onCancel}
      className="w-2xl"
      labelledBy="save-renamed-theme-title"
      title="Save renamed theme?"
      closeDisabled={busy}
      disableEscape={busy}
    >
      <p className="mb-4 text-text">
        {`This theme was saved as "${originalTitle}". Do you want to rename that theme to "${newTitle}" or save a new theme with the new name?`}
      </p>
      {busy ? (
        <p className="mb-4 text-muted" role="status">
          Saving theme…
        </p>
      ) : null}
      <ModalFooter spaced>
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={onUpdateExisting}>
          Update existing
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={onSaveAsNew}>
          Save as new theme
        </Button>
      </ModalFooter>
    </Modal>
  );
}
