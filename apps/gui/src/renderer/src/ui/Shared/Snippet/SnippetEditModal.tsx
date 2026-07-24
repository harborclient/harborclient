import { Button, FieldError, Modal, ModalFormLayout } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { SnippetEditDraft } from './snippetEditDraft';
import { SnippetEditFields } from './SnippetEditFields';

interface Props {
  /**
   * Snippet being edited, or a blank draft when creating.
   */
  draft: SnippetEditDraft;

  /**
   * Whether the modal is creating a new snippet.
   */
  isNew: boolean;

  /**
   * True while the save request is in flight.
   */
  saving: boolean;

  /**
   * Inline validation or IPC error message.
   */
  error: string | null;

  /**
   * Updates the draft fields while editing.
   */
  onChange: (draft: SnippetEditDraft) => void;

  /**
   * Closes the modal without saving.
   */
  onCancel: () => void;

  /**
   * Persists the draft snippet.
   */
  onSave: () => void;

  /**
   * When true, shows marketplace snippet source in a read-only preview.
   */
  readOnly?: boolean;

  /**
   * When true, hides the storage-location picker for hub-admin snippet editing.
   */
  hideStorageLocation?: boolean;
}

/**
 * Very large modal for creating or editing a reusable JavaScript snippet.
 */
export function SnippetEditModal({
  draft,
  isNew,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
  readOnly = false,
  hideStorageLocation = false
}: Props): JSX.Element {
  const title = readOnly ? 'View snippet' : isNew ? 'Add snippet' : 'Edit snippet';
  const description = readOnly
    ? 'Read-only preview of a marketplace snippet. Clone it to make an editable copy.'
    : 'Reusable JavaScript used in the pre-request and post-request stages.';

  return (
    <Modal
      className="flex w-[min(92vw,72rem)] max-h-[85vh] flex-col overflow-hidden"
      labelledBy="snippet-edit-title"
      onClose={onCancel}
      title={title}
      description={description}
      closeDisabled={saving}
      disableEscape={saving}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : undefined}
        actions={
          readOnly ? (
            <Button type="button" onClick={onCancel}>
              Close
            </Button>
          ) : (
            <Button type="button" disabled={saving} onClick={() => void onSave()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )
        }
      >
        <SnippetEditFields
          draft={draft}
          isNew={isNew}
          saving={saving}
          readOnly={readOnly}
          hideStorageLocation={hideStorageLocation}
          onChange={onChange}
        />
      </ModalFormLayout>
    </Modal>
  );
}
