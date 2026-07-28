import type { WorkflowAction } from '@harborclient/core/types';
import {
  Button,
  CodeEditor,
  FieldError,
  FormGroup,
  Modal,
  ModalFooter
} from '@harborclient/sdk/components';
import { useCallback, useId, useMemo, useState, type JSX } from 'react';

interface Props {
  /**
   * Timeline action whose payload is being edited.
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
 * Blocking editor for a workflow action payload as pretty-printed JSON.
 *
 * Update applies the parsed payload to the parent timeline buffer only; it does
 * not persist until the workflow Save control runs.
 *
 * @param props - Action to edit and close/update handlers.
 * @returns Modal with a JSON CodeEditor and Update/Cancel actions.
 */
export function WorkflowActionPayloadModal({ action, onClose, onUpdate }: Props): JSX.Element {
  const titleId = 'workflow-action-payload-title';
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
      title="Edit action payload"
      description={`JSON payload for “${action.type}”. Changes apply to the timeline only until you save the workflow.`}
    >
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

      {hasError ? (
        <FieldError id={errorId} spacing="section" className="mt-3">
          {error}
        </FieldError>
      ) : null}

      <ModalFooter spaced>
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
