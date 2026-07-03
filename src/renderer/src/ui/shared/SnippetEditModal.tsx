import {
  Button,
  CodeEditor,
  FieldError,
  Input,
  Modal,
  ModalFormLayout,
  Select
} from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { SNIPPET_SCOPE_OPTIONS, type SnippetScope } from '#/shared/snippetScope';
import type { SnippetEditDraft } from '#/renderer/src/ui/shared/snippetEditDraft';

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
  onSave
}: Props): JSX.Element {
  return (
    <Modal
      className="flex w-[min(92vw,72rem)] max-h-[85vh] flex-col overflow-hidden"
      labelledBy="snippet-edit-title"
      onClose={onCancel}
      title={isNew ? 'Add snippet' : 'Edit snippet'}
      description="Reusable JavaScript used in pre-request and post-request script lists."
      closeDisabled={saving}
      disableEscape={saving}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : undefined}
        actions={
          <Button type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="snippet-name">
              Name
            </label>
            <Input
              id="snippet-name"
              value={draft.name}
              disabled={saving}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="Snippet name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="snippet-scope">
              Runs in
            </label>
            <Select
              id="snippet-scope"
              className="w-full"
              value={draft.scope}
              disabled={saving}
              onChange={(event) =>
                onChange({ ...draft, scope: event.target.value as SnippetScope })
              }
            >
              {SNIPPET_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="snippet-code">
              JavaScript
            </label>
            <CodeEditor
              id="snippet-code"
              value={draft.code}
              onChange={(code) => onChange({ ...draft, code })}
              language="javascript"
              minHeight="500px"
              placeholder="// hc.variables.set('token', 'abc');"
              aria-labelledby="snippet-code"
            />
          </div>
        </div>
      </ModalFormLayout>
    </Modal>
  );
}
