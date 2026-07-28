import { useCallback, useMemo, useState, useSyncExternalStore, type JSX } from 'react';
import type { PageRef } from '#/renderer/src/store/tabs';
import { useStore } from 'react-redux';
import type { RootState } from '#/renderer/src/store/redux';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectWorkflows } from '#/renderer/src/store/slices/workflowsSlice';
import {
  getWorkflowRunExportForEntry,
  getWorkflowRunLog,
  getWorkflowRunLogMeta,
  getWorkflowRunLogVersion,
  subscribeWorkflowRunLog,
  type WorkflowRunLogEntry,
  type WorkflowRunLogMeta
} from '#/renderer/src/workflows/workflowRunLog';
import { WorkflowRunResultBlock } from './WorkflowRunResultBlock';
import { WorkflowRunResultDetailModal } from './WorkflowRunResultDetailModal';

interface Props {
  /**
   * Active workflow-run-results page tab identity.
   */
  page: Extract<PageRef, { type: 'workflow-run-results' }>;
}

/**
 * Snapshot of the in-memory run log when it matches a page workflow uuid.
 */
interface MatchingRunLog {
  /**
   * Run metadata when the log matches; null when empty / mismatched.
   */
  meta: WorkflowRunLogMeta | null;

  /**
   * Ordered executed steps.
   */
  entries: readonly WorkflowRunLogEntry[];
}

/**
 * Reads the current run-log snapshot when it matches the page workflow uuid.
 *
 * @param workflowUuid - Portable workflow uuid from the page tab.
 * @returns Matching meta and entries, or empty when the log does not match.
 */
function readMatchingRunLog(workflowUuid: string): MatchingRunLog {
  const meta = getWorkflowRunLogMeta();
  if (meta == null || meta.workflowUuid !== workflowUuid) {
    return { meta: null, entries: [] };
  }
  return { meta, entries: getWorkflowRunLog() };
}

/**
 * Page tab listing workflow actions in the exact order they ran.
 *
 * Reads the in-memory run log for {@link page.workflowUuid}. Clicking a block
 * opens a read-only JSON modal with a single-action `workflow-run` export.
 *
 * @param props - Page identity with the workflow uuid.
 * @returns Scrollable list of timeline blocks and optional detail modal.
 */
export function WorkflowRunResults({ page }: Props): JSX.Element {
  const store = useStore<RootState>();
  const workflows = useAppSelector(selectWorkflows);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /**
   * Subscribes to the module-level run log version so the list stays in sync with playback.
   */
  const runLogVersion = useSyncExternalStore(
    subscribeWorkflowRunLog,
    getWorkflowRunLogVersion,
    getWorkflowRunLogVersion
  );

  /**
   * Derives the matching run-log snapshot whenever the external version or page uuid changes.
   */
  const runLog = useMemo(() => {
    void runLogVersion;
    return readMatchingRunLog(page.workflowUuid);
  }, [page.workflowUuid, runLogVersion]);

  /**
   * Display name for the page header.
   */
  const workflowName = useMemo(() => {
    if (runLog.meta != null) {
      return runLog.meta.name;
    }
    return workflows.find((item) => item.uuid === page.workflowUuid)?.name ?? 'Workflow';
  }, [page.workflowUuid, workflows, runLog.meta]);

  /**
   * Single-action export for the open detail modal.
   */
  const detailExport = useMemo(() => {
    void runLogVersion;
    if (selectedIndex == null) {
      return null;
    }
    return getWorkflowRunExportForEntry(selectedIndex);
  }, [selectedIndex, runLogVersion]);

  /**
   * Opens the JSON detail modal for a run-log index.
   *
   * @param index - 0-based index into the run log.
   */
  const handleOpen = useCallback((index: number): void => {
    setSelectedIndex(index);
  }, []);

  /**
   * Closes the JSON detail modal.
   */
  const handleCloseDetail = useCallback((): void => {
    setSelectedIndex(null);
  }, []);

  const { entries } = runLog;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-separator px-4 py-3">
        <h1 className="text-[18px] font-semibold">Results: {workflowName}</h1>
        <p className="text-muted">Actions in the order they ran during the last workflow run.</p>
      </header>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6" role="status">
          <p className="text-muted">
            No run results yet. Finish a workflow run, then open Results from the run dialog.
          </p>
        </div>
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4"
          role="listbox"
          aria-label="Workflow run actions"
          aria-activedescendant={
            selectedIndex != null ? `workflow-run-result-${selectedIndex}` : undefined
          }
        >
          {entries.map((entry, index) => (
            <WorkflowRunResultBlock
              key={`${entry.action.uuid}-${index}`}
              id={`workflow-run-result-${index}`}
              action={entry.action}
              selected={selectedIndex === index}
              getState={store.getState}
              onOpen={() => {
                handleOpen(index);
              }}
            />
          ))}
        </div>
      )}

      <WorkflowRunResultDetailModal exportPayload={detailExport} onClose={handleCloseDetail} />
    </div>
  );
}
