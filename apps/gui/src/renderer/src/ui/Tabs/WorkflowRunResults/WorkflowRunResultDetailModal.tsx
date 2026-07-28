import { useCallback, useId, useMemo, type JSX } from 'react';
import { CodeEditor, Modal, ModalFooter, Button } from '@harborclient/sdk/components';

interface Props {
  /**
   * Per-action run result to display, or null when closed.
   */
  result: unknown | null;

  /**
   * Closes the detail modal.
   */
  onClose: () => void;
}

/**
 * Reads a display title from an action result when it has a string `name`.
 *
 * @param result - Action result payload.
 * @returns Result name, or a generic fallback.
 */
function actionResultTitle(result: unknown): string {
  if (result != null && typeof result === 'object' && 'name' in result) {
    const name = (result as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name;
    }
  }
  return 'Action result';
}

/**
 * Read-only JSON viewer for one workflow-run action result.
 *
 * Shows only the action's result object (payload or request-send snapshot),
 * not the full `workflow-run` export envelope.
 *
 * @param props - Result payload and close handler.
 * @returns Modal with a read-only JSON CodeEditor, or null when closed.
 */
export function WorkflowRunResultDetailModal({ result, onClose }: Props): JSX.Element | null {
  const titleId = 'workflow-run-result-detail-title';
  const editorId = useId();

  /**
   * Pretty-printed JSON for the CodeEditor.
   */
  const draft = useMemo(() => (result == null ? '' : JSON.stringify(result, null, 2)), [result]);

  /**
   * No-op change handler; the editor is read-only.
   */
  const handleChange = useCallback((): void => {}, []);

  if (result == null) {
    return null;
  }

  const title = actionResultTitle(result);

  return (
    <Modal
      className="flex w-[40rem] max-w-[90vw] flex-col"
      overlayClassName="z-[70]"
      labelledBy={titleId}
      onClose={onClose}
      title={title}
      description="JSON result for this workflow action."
    >
      <div className="flex min-h-0 flex-col gap-3">
        <CodeEditor
          id={editorId}
          value={draft}
          onChange={handleChange}
          language="json"
          readOnly
          minHeight="320px"
          aria-label="Workflow action result JSON"
        />
      </div>
      <ModalFooter spaced>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
