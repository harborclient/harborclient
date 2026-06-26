import { useCallback, useEffect, useMemo, type JSX } from 'react';
import {
  getRequestsInRunOrder,
  type CollectionRunnerRequestResult
} from '#/shared/collectionRunner';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  cancelCollectionRunner,
  closeCollectionRunnerModal,
  selectCollectionRunnerModal,
  setCollectionRunnerConfig
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { runCollectionRequests } from '#/renderer/src/store/thunks/collectionRunner';
import { Button } from '#/renderer/src/components/Button';
import { Input, Select } from '#/renderer/src/components/forms';
import { Modal } from '#/renderer/src/components/Modal';

/**
 * Returns a human-readable label for a collection runner result row.
 *
 * @param result - Result row from the active collection run.
 * @returns Status text paired with color indicators elsewhere in the UI.
 */
function resultStatusLabel(result: CollectionRunnerRequestResult): string {
  switch (result.status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running…';
    case 'passed':
      return 'Passed';
    case 'failed':
      if (result.httpError) {
        return `Failed: ${result.httpError}`;
      }
      if (result.httpStatus != null && result.httpStatus >= 400) {
        return `Failed: HTTP ${result.httpStatus}`;
      }
      if (result.testsFailed > 0) {
        return `Failed: ${result.testsFailed} test${result.testsFailed === 1 ? '' : 's'} failed`;
      }
      return 'Failed';
    case 'skipped':
      return 'Skipped';
  }
}

/**
 * Modal for configuring and running saved requests in a collection or folder.
 */
export function CollectionRunnerModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const runner = useAppSelector(selectCollectionRunnerModal);
  const environments = useAppSelector(selectEnvironments);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);

  const runnerTargetKey = runner ? `${runner.collectionId}:${runner.folderId ?? 'root'}` : null;

  /**
   * Loads persisted runner settings when the modal opens for a new target.
   */
  useEffect(() => {
    if (!runnerTargetKey) {
      return;
    }

    let cancelled = false;
    void window.api.getCollectionRunnerConfig().then((config) => {
      if (cancelled) {
        return;
      }
      dispatch(setCollectionRunnerConfig(config));
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch, runnerTargetKey]);

  /**
   * Ordered requests for the current run target, used to disable Run when empty.
   */
  const orderedRequests = useMemo(() => {
    if (!runner) {
      return [];
    }
    return getRequestsInRunOrder(
      runner.collectionId,
      runner.folderId,
      requestsByCollection[runner.collectionId] ?? [],
      foldersByCollection[runner.collectionId] ?? []
    );
  }, [runner, requestsByCollection, foldersByCollection]);

  /**
   * Progress percentage for the determinate progress bar during a run.
   */
  const progressPercent = useMemo((): number => {
    if (!runner || runner.total === 0) {
      return 0;
    }
    return Math.round((runner.completed / runner.total) * 100);
  }, [runner]);

  /**
   * Closes the modal when a run is not in progress.
   */
  const handleClose = useCallback((): void => {
    if (runner?.running) {
      return;
    }
    dispatch(closeCollectionRunnerModal());
  }, [dispatch, runner?.running]);

  /**
   * Persists settings and starts the sequential collection run.
   */
  const handleRun = useCallback((): void => {
    if (!runner || orderedRequests.length === 0 || runner.running) {
      return;
    }
    void dispatch(runCollectionRequests());
  }, [dispatch, orderedRequests.length, runner]);

  /**
   * Requests cancellation before the next request loads.
   */
  const handleStop = useCallback((): void => {
    dispatch(cancelCollectionRunner());
  }, [dispatch]);

  if (!runner) {
    return null;
  }

  const title = runner.folderName
    ? `Run folder "${runner.folderName}" in "${runner.collectionName}"`
    : `Run "${runner.collectionName}"`;

  return (
    <Modal
      onClose={handleClose}
      className="w-[32rem]"
      labelledBy="collection-runner-modal-title"
      title={title}
      disableEscape={runner.running}
      closeDisabled={runner.running}
    >
      {runner.phase === 'configure' && (
        <div className="space-y-4">
          <p className="m-0 text-[14px] text-muted">
            {orderedRequests.length === 0
              ? 'This target has no saved requests to run.'
              : `${orderedRequests.length} request${orderedRequests.length === 1 ? '' : 's'} will run in sidebar order.`}
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-medium text-text">Delay between requests (ms)</span>
            <Input
              id="collection-runner-delay"
              type="number"
              min={0}
              value={runner.delayMs}
              onChange={(event) =>
                dispatch(
                  setCollectionRunnerConfig({
                    delayMs: Math.max(0, Number(event.target.value) || 0)
                  })
                )
              }
            />
          </label>

          <label className="flex items-center gap-2">
            <Input
              id="collection-runner-stop-on-failure"
              type="checkbox"
              checked={runner.stopOnFailure}
              onChange={(event) =>
                dispatch(setCollectionRunnerConfig({ stopOnFailure: event.target.checked }))
              }
            />
            <span className="text-[14px] font-medium text-text">Stop on failure</span>
          </label>

          <fieldset className="m-0 space-y-2 border-none p-0">
            <legend className="mb-2 text-[14px] font-medium text-text">Environment</legend>
            <label className="flex items-center gap-2">
              <Input
                type="radio"
                name="collection-runner-environment-mode"
                checked={runner.environmentMode === 'active'}
                onChange={() =>
                  dispatch(
                    setCollectionRunnerConfig({ environmentMode: 'active', environmentId: null })
                  )
                }
              />
              <span className="text-[14px] text-text">Use active environment</span>
            </label>
            <label className="flex items-center gap-2">
              <Input
                type="radio"
                name="collection-runner-environment-mode"
                checked={runner.environmentMode === 'override'}
                onChange={() =>
                  dispatch(
                    setCollectionRunnerConfig({
                      environmentMode: 'override',
                      environmentId: runner.environmentId ?? environments[0]?.id ?? null
                    })
                  )
                }
              />
              <span className="text-[14px] text-text">Override environment</span>
            </label>
            {runner.environmentMode === 'override' && (
              <Select
                id="collection-runner-environment"
                className="w-full cursor-pointer py-1 text-[14px]"
                value={runner.environmentId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  dispatch(
                    setCollectionRunnerConfig({
                      environmentId: value ? Number(value) : null
                    })
                  );
                }}
                aria-label="Override environment"
              >
                <option value="">No Environment</option>
                {environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name}
                  </option>
                ))}
              </Select>
            )}
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" disabled={orderedRequests.length === 0} onClick={handleRun}>
              Run
            </Button>
          </div>
        </div>
      )}

      {(runner.phase === 'running' || runner.phase === 'complete') && (
        <div className="space-y-4">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="Collection run progress"
            className="h-2 overflow-hidden rounded-full bg-separator"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="m-0 text-[14px] text-muted" role="status" aria-live="polite">
            {runner.phase === 'running'
              ? `Running ${runner.completed} of ${runner.total} requests…`
              : `Finished: ${runner.summary.passed} passed, ${runner.summary.failed} failed${
                  runner.summary.skipped > 0 ? `, ${runner.summary.skipped} skipped` : ''
                }`}
          </p>

          <ul className="m-0 max-h-64 list-none space-y-2 overflow-y-auto p-0">
            {runner.results.map((result) => (
              <li
                key={result.requestId}
                className="rounded border border-separator px-3 py-2 text-[14px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 truncate font-medium text-text">{result.requestName}</p>
                    {result.status !== 'pending' && result.status !== 'running' && (
                      <p className="m-0 text-[14px] text-muted">
                        {result.httpStatus != null ? `HTTP ${result.httpStatus}` : 'No response'}
                        {result.testsPassed + result.testsFailed > 0
                          ? ` · ${result.testsPassed} passed, ${result.testsFailed} failed`
                          : ''}
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      result.status === 'failed'
                        ? 'text-danger'
                        : result.status === 'passed'
                          ? 'text-text'
                          : 'text-muted'
                    }
                  >
                    <span
                      className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                        result.status === 'passed'
                          ? 'bg-success'
                          : result.status === 'failed'
                            ? 'bg-danger'
                            : 'bg-muted'
                      }`}
                      aria-hidden="true"
                    />
                    {resultStatusLabel(result)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-end gap-2">
            {runner.running ? (
              <Button type="button" variant="secondaryDanger" onClick={handleStop}>
                Stop
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
