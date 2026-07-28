import toast from 'react-hot-toast';
import type { RootState } from '#/renderer/src/store/redux';
import { getWorkflowRunExport } from './workflowRunLog';
import { buildWorkflowRunExportFileName } from './workflowRunExportFile';

/**
 * Writes the current workflow-run export to the configured results directory.
 *
 * No-ops when the directory setting is empty or there is no run log metadata.
 * Export failures are reported with a toast and do not throw.
 *
 * @param getState - Redux state accessor for the workflow results directory setting.
 * @returns Resolves after the write attempt completes or is skipped.
 */
export async function exportCompletedWorkflowRunIfConfigured(
  getState: () => RootState
): Promise<void> {
  const directory = getState().settings?.general?.workflowResultsDirectory?.trim() ?? '';
  if (!directory) {
    return;
  }

  const envelope = getWorkflowRunExport();
  if (envelope == null) {
    return;
  }

  const fileName = buildWorkflowRunExportFileName();
  const content = JSON.stringify(envelope, null, 2);

  try {
    await window.api.writeTextInDirectory(directory, fileName, content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`Failed to export workflow results: ${message}`);
  }
}
