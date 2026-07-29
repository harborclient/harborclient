import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type JSX } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@harborclient/sdk/components';
import type { PageRef } from '#/renderer/src/store/tabs';
import { useStore } from 'react-redux';
import type { RootState } from '#/renderer/src/store/redux';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectWorkflows } from '#/renderer/src/store/slices/workflowsSlice';
import {
  getWorkflowRunExport,
  getWorkflowRunLog,
  getWorkflowRunLogMeta,
  getWorkflowRunLogVersion,
  subscribeWorkflowRunLog,
  type WorkflowRunLogEntry,
  type WorkflowRunLogMeta
} from '#/renderer/src/workflows/workflowRunLog';
import { buildWorkflowRunExportFileName } from '#/renderer/src/workflows/workflowRunExportFile';
import { WorkflowRunResultBlock } from './WorkflowRunResultBlock';
import { WorkflowRunResultDetailPanel } from './WorkflowRunResultDetailPanel';

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
 * opens a bottom detail panel: Response Editor for request sends, JSON otherwise.
 *
 * @param props - Page identity with the workflow uuid.
 * @returns Scrollable list of timeline blocks and optional detail panel.
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
   * True when the matching run log has metadata and at least one executed step.
   */
  const canExport = runLog.meta != null && runLog.entries.length > 0;

  /**
   * Selected run-log entry for the bottom detail panel.
   */
  const selectedEntry = useMemo(() => {
    void runLogVersion;
    if (selectedIndex == null || selectedIndex >= runLog.entries.length) {
      return null;
    }
    return runLog.entries[selectedIndex] ?? null;
  }, [selectedIndex, runLog.entries, runLogVersion]);

  /**
   * Resolved selection index when it still points at a live run-log entry.
   */
  const activeSelectedIndex =
    selectedIndex != null && selectedIndex < runLog.entries.length ? selectedIndex : null;

  /**
   * Opens or toggles the detail panel for a run-log index.
   *
   * @param index - 0-based index into the run log.
   */
  const handleOpen = useCallback((index: number): void => {
    setSelectedIndex((current) => (current === index ? null : index));
  }, []);

  /**
   * Closes the detail panel.
   */
  const handleCloseDetail = useCallback((): void => {
    setSelectedIndex(null);
  }, []);

  /**
   * Dismisses the detail panel when Escape is pressed while a row is selected.
   */
  useEffect(() => {
    if (activeSelectedIndex == null) {
      return;
    }

    /**
     * Closes the panel on Escape without interfering with other Escape handlers.
     *
     * @param event - Keyboard event from the document.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      setSelectedIndex(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSelectedIndex]);

  /**
   * Exports the current workflow-run envelope to a JSON file via the native save dialog.
   */
  const handleExport = useCallback((): void => {
    if (!canExport) {
      return;
    }
    const envelope = getWorkflowRunExport();
    if (envelope == null) {
      return;
    }
    const content = JSON.stringify(envelope, null, 2);
    const fileName = buildWorkflowRunExportFileName();
    void window.api
      .saveTextFile(content, fileName)
      .then((result) => {
        if (!result.canceled) {
          toast.success('Workflow results exported');
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Failed to export workflow results: ${message}`);
      });
  }, [canExport]);

  const { entries } = runLog;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-separator px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold">Results: {workflowName}</h1>
          <p className="text-muted">Actions in the order they ran during the last workflow run.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="secondary" disabled={!canExport} onClick={handleExport}>
            Export
          </Button>
        </div>
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
            activeSelectedIndex != null ? `workflow-run-result-${activeSelectedIndex}` : undefined
          }
        >
          {entries.map((entry, index) => (
            <WorkflowRunResultBlock
              key={`${entry.action.uuid}-${index}`}
              id={`workflow-run-result-${index}`}
              index={index + 1}
              action={entry.action}
              result={entry.result}
              ranAt={entry.ranAt}
              durationMs={entry.durationMs}
              selected={activeSelectedIndex === index}
              getState={store.getState}
              onOpen={() => {
                handleOpen(index);
              }}
            />
          ))}
        </div>
      )}

      <WorkflowRunResultDetailPanel
        action={selectedEntry?.action ?? null}
        result={selectedEntry?.result ?? null}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
