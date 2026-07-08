import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  buildRunResultsExport,
  getCollectionRunnerRequests,
  resolveImportedRunnerTargetIds,
  type CollectionRunnerRequestResult
} from '#/shared/collectionRunner';
import { buildRunResultsDeepLink } from '#/shared/deepLink';
import type { PageRef } from '#/renderer/src/store/drafts';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  cancelCollectionRunner,
  importCollectionRunnerResults,
  openCollectionRunner,
  selectCollectionRunner,
  setCollectionRunnerConfig
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectCollections,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { runCollectionRequests } from '#/renderer/src/store/thunks/collectionRunner';
import { saveRunResult } from '#/renderer/src/store/thunks/runResults';
import { Button, FaIcon } from '@harborclient/sdk/components';
import { FormGroup } from '@harborclient/sdk/components';
import { Checkbox, Input, Radio, Select } from '@harborclient/sdk/components';
import {
  resolveRunnerTargetNames,
  runnerPageTitle,
  type RunnerTargetRef
} from '#/renderer/src/ui/CollectionRunner/resolveRunnerTargetName';
import { CollectionRunnerResultModal } from '#/renderer/src/ui/CollectionRunner/CollectionRunnerResultModal';
import { CollectionRunnerSaveModal } from '#/renderer/src/ui/CollectionRunner/CollectionRunnerSaveModal';
import { ResponseSummary } from '#/renderer/src/ui/Main/ResponseEditor/ResponseSummary';
import { METHOD_CLASSES } from '#/renderer/src/ui/shared/classes';
import { faLink } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Active collection runner page tab identity.
   */
  page: Extract<PageRef, { type: 'collection-runner' }>;
}

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
 * Returns whether runner state matches the page tab target identity.
 *
 * @param runner - Active collection runner state, if any.
 * @param target - Page tab target identity.
 * @returns True when both refer to the same collection, folder, or request run.
 */
function runnerMatchesTarget(
  runner: ReturnType<typeof selectCollectionRunner>,
  target: RunnerTargetRef
): boolean {
  if (!runner) {
    return false;
  }
  return (
    runner.collectionId === target.collectionId &&
    runner.folderId === (target.folderId ?? null) &&
    runner.requestId === (target.requestId ?? null)
  );
}

/**
 * Page tab for configuring and running saved requests in a collection, folder, or single request.
 */
export function CollectionRunner({ page }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const runner = useAppSelector(selectCollectionRunner);
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);

  const collectionId = page.collectionId;
  const folderId = page.folderId ?? null;
  const requestId = page.requestId ?? null;

  const targetNames = useMemo(
    () =>
      resolveRunnerTargetNames(
        { collectionId, folderId, requestId },
        collections,
        foldersByCollection[collectionId] ?? [],
        requestsByCollection[collectionId] ?? []
      ),
    [collectionId, folderId, requestId, collections, foldersByCollection, requestsByCollection]
  );

  const title = useMemo(() => {
    if (runner?.imported) {
      return runnerPageTitle({
        collectionName: runner.collectionName,
        folderName: runner.folderName,
        requestName: runner.requestName
      });
    }
    return runnerPageTitle(targetNames);
  }, [runner, targetNames]);

  const canExport = Boolean(runner && runner.results.length > 0 && !runner.running);
  // Saving again is allowed even after a prior save, since the user may want to
  // additionally save (or move) the same run results to a different data source.
  const canSave = Boolean(
    runner && runner.phase === 'complete' && runner.results.length > 0 && !runner.running
  );
  const canCopyDeepLink = Boolean(runner?.savedToTeamHub && runner.savedRunUuid);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  /**
   * Initializes or retargets runner state when the page tab opens or changes target.
   */
  useEffect(() => {
    if (runner?.imported) {
      return;
    }

    if (runner?.running) {
      return;
    }

    if (runnerMatchesTarget(runner, { collectionId, folderId, requestId })) {
      return;
    }

    dispatch(
      openCollectionRunner({
        collectionId,
        folderId,
        requestId,
        collectionName: targetNames.collectionName,
        folderName: targetNames.folderName,
        requestName: targetNames.requestName
      })
    );
  }, [
    dispatch,
    runner,
    runner?.imported,
    collectionId,
    folderId,
    requestId,
    targetNames.collectionName,
    targetNames.folderName,
    targetNames.requestName
  ]);

  const runnerTargetKey = runner
    ? `${runner.collectionId}:${runner.folderId ?? 'root'}:${runner.requestId ?? 'all'}`
    : null;

  /**
   * Loads persisted runner settings when the runner target changes.
   */
  useEffect(() => {
    if (runner?.imported || !runnerTargetKey || runner?.running) {
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
  }, [dispatch, runnerTargetKey, runner?.running, runner?.imported]);

  /**
   * Ordered requests for the current run target, used to disable Run when empty.
   */
  const orderedRequests = useMemo(() => {
    if (!runner) {
      return [];
    }
    return getCollectionRunnerRequests(
      runner.collectionId,
      runner.folderId,
      runner.requestId,
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
   * Starts the sequential collection run when not already running.
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
  const handleCancel = useCallback((): void => {
    dispatch(cancelCollectionRunner());
  }, [dispatch]);

  const formDisabled = runner?.running ?? false;
  const showResults = runner?.phase === 'running' || runner?.phase === 'complete';
  const [selectedResult, setSelectedResult] = useState<CollectionRunnerRequestResult | null>(null);

  /**
   * Closes the response detail modal.
   */
  const handleCloseResultModal = useCallback((): void => {
    setSelectedResult(null);
  }, []);

  /**
   * Builds the portable export payload for the current runner state.
   */
  const buildCurrentRunResultsPayload = useCallback(() => {
    if (!runner || runner.results.length === 0) {
      return null;
    }

    const collection = collections.find((item) => item.id === runner.collectionId);
    const requests = requestsByCollection[runner.collectionId] ?? [];
    const savedRequest =
      runner.requestId != null
        ? requests.find((request) => request.id === runner.requestId)
        : undefined;
    const environment =
      runner.environmentMode === 'override' && runner.environmentId != null
        ? environments.find((item) => item.id === runner.environmentId)
        : undefined;

    return buildRunResultsExport({
      requestId: runner.requestId,
      collectionName: runner.collectionName,
      folderName: runner.folderName,
      requestName: runner.requestName,
      collectionUuid: collection?.uuid ?? null,
      requestUuid: savedRequest?.uuid ?? null,
      requestMethod: savedRequest?.method ?? runner.results[0]?.requestMethod ?? null,
      delayMs: runner.delayMs,
      stopOnFailure: runner.stopOnFailure,
      environmentMode: runner.environmentMode,
      environmentId: runner.environmentId,
      environmentName:
        runner.environmentName ??
        environment?.name ??
        (runner.environmentMode === 'active' ? 'Active environment' : null),
      results: runner.results
    });
  }, [collections, environments, requestsByCollection, runner]);

  /**
   * Exports the current run results to a JSON file via the native save dialog.
   */
  const handleExport = useCallback((): void => {
    const payload = buildCurrentRunResultsPayload();
    if (!payload) {
      return;
    }

    void window.api.exportRunResults(payload).then((result) => {
      if (!result.canceled && result.path) {
        toast.success('Run results exported');
      }
    });
  }, [buildCurrentRunResultsPayload]);

  /**
   * Opens the save destination modal for the completed run.
   */
  const handleSave = useCallback((): void => {
    if (!canSave) {
      return;
    }
    setSaveModalOpen(true);
  }, [canSave]);

  /**
   * Persists the completed run to the selected storage provider.
   *
   * @param connectionId - Provider connection id chosen in the save modal.
   * @param savedToTeamHub - True when the destination is a Team Hub provider.
   */
  const handleSaveConfirm = useCallback(
    (connectionId: string, savedToTeamHub: boolean): void => {
      const payload = buildCurrentRunResultsPayload();
      if (!payload) {
        return;
      }

      setSaveModalOpen(false);
      void dispatch(
        saveRunResult({
          connectionId,
          input: { payload },
          savedToTeamHub
        })
      );
    },
    [buildCurrentRunResultsPayload, dispatch]
  );

  /**
   * Copies a Team Hub deep link for the saved run result UUID.
   */
  const handleCopyDeepLink = useCallback((): void => {
    if (!runner?.savedRunUuid || !runner.savedToTeamHub) {
      return;
    }

    const url = buildRunResultsDeepLink(runner.savedRunUuid);
    void navigator.clipboard.writeText(url).then(() => {
      toast.success('Run result link copied');
    });
  }, [runner]);

  /**
   * Imports run results from disk into the detached read-only runner view.
   */
  const handleImport = useCallback((): void => {
    void window.api.importRunResults().then((data) => {
      if (!data) {
        return;
      }
      const { collectionId, requestId } = resolveImportedRunnerTargetIds(
        data,
        collections,
        requestsByCollection
      );
      dispatch(importCollectionRunnerResults({ ...data, collectionId, requestId }));
      toast.success('Run results imported');
    });
  }, [collections, dispatch, requestsByCollection]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="m-0 min-w-0 text-[18px] font-semibold text-text">{title}</h1>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Copy run result link"
            disabled={!canCopyDeepLink}
            onClick={handleCopyDeepLink}
          >
            <FaIcon icon={faLink} className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="secondary" disabled={!canExport} onClick={handleExport}>
            Export
          </Button>
          <Button type="button" variant="secondary" onClick={handleImport}>
            Import
          </Button>
        </div>
      </div>

      {runner ? (
        <div className="space-y-4">
          {runner.imported ? (
            <div className="space-y-2 text-[16px]">
              <p className="m-0 text-muted">Imported run results (read-only)</p>
              <p className="m-0">
                Delay between requests: <span className="text-text">{runner.delayMs} ms</span>
              </p>
              <p className="m-0">
                Stop on failure:{' '}
                <span className="text-text">{runner.stopOnFailure ? 'Yes' : 'No'}</span>
              </p>
              <p className="m-0">
                Environment:{' '}
                <span className="text-text">
                  {runner.environmentMode === 'override'
                    ? (runner.environmentName ?? 'Override')
                    : (runner.environmentName ?? 'Active environment')}
                </span>
              </p>
            </div>
          ) : (
            <>
              <p className="m-0 text-[16px] mb-2">
                {orderedRequests.length === 0
                  ? 'This target has no saved requests to run.'
                  : `${orderedRequests.length} request${orderedRequests.length === 1 ? '' : 's'} will run in sidebar order.`}
              </p>

              <FormGroup label="Delay between requests (ms)">
                <Input
                  id="collection-runner-delay"
                  type="number"
                  min={0}
                  value={runner.delayMs}
                  disabled={formDisabled}
                  onChange={(event) =>
                    dispatch(
                      setCollectionRunnerConfig({
                        delayMs: Math.max(0, Number(event.target.value) || 0)
                      })
                    )
                  }
                />
              </FormGroup>

              <FormGroup label="Stop on failure" layout="checkbox">
                <Checkbox
                  id="collection-runner-stop-on-failure"
                  checked={runner.stopOnFailure}
                  disabled={formDisabled}
                  onChange={(event) =>
                    dispatch(setCollectionRunnerConfig({ stopOnFailure: event.target.checked }))
                  }
                />
              </FormGroup>

              <fieldset className="m-0 space-y-2 border-none p-0 mb-4" disabled={formDisabled}>
                <legend className="mb-2 text-[16px] font-medium text-text">Environment</legend>
                <FormGroup label="Use active environment" layout="checkbox">
                  <Radio
                    name="collection-runner-environment-mode"
                    checked={runner.environmentMode === 'active'}
                    disabled={formDisabled}
                    onChange={() =>
                      dispatch(
                        setCollectionRunnerConfig({
                          environmentMode: 'active',
                          environmentId: null
                        })
                      )
                    }
                  />
                </FormGroup>
                <FormGroup label="Override environment" layout="checkbox">
                  <Radio
                    name="collection-runner-environment-mode"
                    checked={runner.environmentMode === 'override'}
                    disabled={formDisabled}
                    onChange={() =>
                      dispatch(
                        setCollectionRunnerConfig({
                          environmentMode: 'override',
                          environmentId: runner.environmentId ?? environments[0]?.id ?? null
                        })
                      )
                    }
                  />
                </FormGroup>
                {runner.environmentMode === 'override' && (
                  <Select
                    id="collection-runner-environment"
                    className="w-full cursor-pointer py-1 text-[16px]"
                    value={runner.environmentId ?? ''}
                    disabled={formDisabled}
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

              <div>
                {runner.running ? (
                  <Button type="button" variant="secondaryDanger" onClick={handleCancel}>
                    Cancel
                  </Button>
                ) : (
                  <Button type="button" disabled={orderedRequests.length === 0} onClick={handleRun}>
                    Run
                  </Button>
                )}
              </div>
            </>
          )}

          {showResults && (
            <div className="space-y-4 border-t border-separator pt-4">
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

              <div
                className="mb-3 flex items-center justify-between gap-3 border border-md border-separator p-4"
                role="status"
                aria-live="polite"
              >
                <p className="m-0 text-[16px]">
                  {runner.phase === 'running'
                    ? `Running ${runner.completed} of ${runner.total} requests…`
                    : `Finished: ${runner.summary.passed} passed, ${runner.summary.failed} failed${
                        runner.summary.skipped > 0 ? `, ${runner.summary.skipped} skipped` : ''
                      }`}
                </p>
                {runner.phase === 'complete' ? (
                  <Button type="button" disabled={!canSave} onClick={handleSave}>
                    Save
                  </Button>
                ) : null}
              </div>

              <ul className="m-0 list-none space-y-3 p-0">
                {runner.results.map((result) => {
                  const hasResponse = result.response != null;
                  const rowContent = (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={`shrink-0 px-1 py-px text-[16px] ${METHOD_CLASSES[result.requestMethod.toLowerCase()] ?? 'text-info'}`}
                          >
                            {result.requestMethod}
                          </span>
                          <p className="m-0 truncate text-[16px] font-medium text-text">
                            {result.requestName}
                          </p>
                        </div>
                        {result.status !== 'pending' && result.status !== 'running' && (
                          <>
                            {hasResponse ? (
                              <ResponseSummary response={result.response!} className="mt-1" />
                            ) : (
                              <p className="m-0 mt-1 text-[14px] text-muted">
                                {result.httpStatus != null
                                  ? `HTTP ${result.httpStatus}`
                                  : 'No response'}
                                {result.testsPassed + result.testsFailed > 0
                                  ? ` · ${result.testsPassed} passed, ${result.testsFailed} failed`
                                  : ''}
                              </p>
                            )}
                          </>
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
                  );

                  return (
                    <li
                      key={result.requestId}
                      className="rounded border border-separator px-3 py-2 text-[14px]"
                    >
                      {hasResponse ? (
                        <button
                          type="button"
                          className="w-full cursor-pointer border-none bg-transparent p-0 text-left hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          aria-label={`View response for ${result.requestMethod} ${result.requestName}`}
                          onClick={() => setSelectedResult(result)}
                        >
                          {rowContent}
                        </button>
                      ) : (
                        rowContent
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <CollectionRunnerResultModal result={selectedResult} onClose={handleCloseResultModal} />
      <CollectionRunnerSaveModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveConfirm}
      />
    </div>
  );
}
