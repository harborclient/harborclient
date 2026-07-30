import type { WorkflowAction } from '@harborclient/core/types';
import {
  Button,
  CodeEditor,
  FaIcon,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFooter
} from '@harborclient/sdk/components';
import { useCallback, useId, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { faTrash } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Timeline action being edited.
   */
  action: WorkflowAction;

  /**
   * Closes the modal without applying draft changes.
   */
  onClose: () => void;

  /**
   * Applies a successfully parsed payload to the in-memory timeline action.
   *
   * @param payload - Parsed JSON value for the action payload.
   */
  onUpdate: (payload: unknown) => void;

  /**
   * Prompts to delete this action from the workflow timeline.
   */
  onDelete: () => void;
}

/**
 * Parses a JSON draft string into a payload value.
 *
 * @param draft - Editor contents to parse.
 * @returns Parsed value, or an error message when JSON is invalid.
 */
function parsePayloadDraft(
  draft: string
): { ok: true; payload: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, payload: JSON.parse(draft) as unknown };
  } catch {
    return { ok: false, error: 'Payload must be valid JSON.' };
  }
}

/**
 * Blocking editor for a workflow action's identity and JSON payload.
 *
 * Shows a readonly action uuid (with copy) and a payload CodeEditor. Update
 * applies the parsed payload to the parent timeline buffer only; it does not
 * persist until the workflow Save control runs. Delete removes the action from
 * the timeline after confirmation in the parent.
 *
 * @param props - Action to edit and close/update/delete handlers.
 * @returns Modal with uuid field, JSON CodeEditor, and Delete/Update/Cancel actions.
 */
export function WorkflowActionPayloadModal({
  action,
  onClose,
  onUpdate,
  onDelete
}: Props): JSX.Element {
  const titleId = 'workflow-action-payload-title';
  const uuidId = useId();
  const editorId = useId();
  const errorId = useId();

  /**
   * Pretty-printed JSON of the action payload when the modal opened.
   */
  const initialDraft = useMemo(
    () => JSON.stringify(action.payload ?? null, null, 2),
    [action.payload]
  );

  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Updates the draft string and clears a stale parse error while typing.
   *
   * @param nextDraft - Latest CodeEditor value.
   */
  const handleDraftChange = useCallback((nextDraft: string): void => {
    setDraft(nextDraft);
    setError(null);
  }, []);

  /**
   * Copies the action uuid to the clipboard and briefly shows a Copied label.
   */
  const handleCopyUuid = useCallback((): void => {
    void navigator.clipboard.writeText(action.uuid).then(
      () => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 2000);
      },
      () => {
        toast.error('Failed to copy');
      }
    );
  }, [action.uuid]);

  /**
   * Parses the draft and applies it when valid; otherwise shows an inline error.
   */
  const handleUpdate = useCallback((): void => {
    const result = parsePayloadDraft(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdate(result.payload);
  }, [draft, onUpdate]);

  const hasError = error != null;

  return (
    <Modal
      className="w-[36rem] max-w-[90vw]"
      overlayClassName="z-[70]"
      labelledBy={titleId}
      onClose={onClose}
      title="Edit action"
      description={`Action “${action.type}”. Changes apply to the timeline only until you save the workflow.`}
    >
      <div className="flex flex-col gap-4">
        <FormGroup label="UUID" htmlFor={uuidId}>
          <div className="flex gap-2">
            <Input
              id={uuidId}
              type="text"
              readOnly
              className="min-w-0 flex-1 font-mono text-[14px]"
              value={action.uuid}
              aria-label="Action UUID"
              onFocus={(event) => event.target.select()}
            />
            <Button
              type="button"
              variant="secondary"
              aria-label="Copy action UUID"
              title="Copy action UUID"
              onClick={handleCopyUuid}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </FormGroup>

        <FormGroup label="Payload JSON" htmlFor={editorId}>
          <CodeEditor
            id={editorId}
            value={draft}
            onChange={handleDraftChange}
            language="json"
            placeholder={'{\n  "key": "value"\n}'}
            minHeight="240px"
            aria-label="Action payload JSON"
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
          />
        </FormGroup>
      </div>

      {hasError ? (
        <FieldError id={errorId} spacing="section" className="mt-3">
          {error}
        </FieldError>
      ) : null}

      <ModalFooter spaced>
        <Button
          type="button"
          variant="secondaryDanger"
          className="mr-auto"
          aria-label="Delete action"
          onClick={onDelete}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <FaIcon icon={faTrash} className="h-3.5 w-3.5" aria-hidden />
            Delete
          </span>
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={handleUpdate}>
          Update
        </Button>
      </ModalFooter>
    </Modal>
  );
}
