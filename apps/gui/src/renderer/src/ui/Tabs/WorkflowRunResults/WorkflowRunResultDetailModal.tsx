import { useCallback, useId, useMemo, type JSX } from 'react';
import { CodeEditor, Modal, ModalFooter, Button } from '@harborclient/sdk/components';
import type { WorkflowRunExport } from '@harborclient/core/types';

interface Props {
  /**
   * Single-action workflow-run export to display, or null when closed.
   */
  exportPayload: WorkflowRunExport | null;

  /**
   * Closes the detail modal.
   */
  onClose: () => void;
}

/**
 * Read-only JSON viewer for one workflow-run action result.
 *
 * Shows a `workflow-run` export envelope with a single action in `actions`,
 * matching the HarborClient export header convention.
 *
 * @param props - Export payload and close handler.
 * @returns Modal with a read-only JSON CodeEditor, or null when closed.
 */
export function WorkflowRunResultDetailModal({
  exportPayload,
  onClose
}: Props): JSX.Element | null {
  const titleId = 'workflow-run-result-detail-title';
  const editorId = useId();

  /**
   * Pretty-printed JSON for the CodeEditor.
   */
  const draft = useMemo(
    () => (exportPayload == null ? '' : JSON.stringify(exportPayload, null, 2)),
    [exportPayload]
  );

  /**
   * No-op change handler; the editor is read-only.
   */
  const handleChange = useCallback((): void => {}, []);

  if (exportPayload == null) {
    return null;
  }

  const actionLabel =
    exportPayload.actions.length === 1 &&
    exportPayload.actions[0] != null &&
    typeof exportPayload.actions[0] === 'object' &&
    'name' in (exportPayload.actions[0] as object)
      ? String((exportPayload.actions[0] as { name?: unknown }).name ?? 'Action result')
      : 'Action result';

  return (
    <Modal
      className="flex w-[40rem] max-w-[90vw] flex-col"
      overlayClassName="z-[70]"
      labelledBy={titleId}
      onClose={onClose}
      title={actionLabel}
      description={`Workflow “${exportPayload.name}” run result.`}
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
