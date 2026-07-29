import type { SendResult, ScriptTestResult } from '../types';
import { buildWorkflowRunExport } from '../types/workflow';
import { resolveWorkflowNextIndex } from './resolveWorkflowNextIndex';
import {
  beginWorkflowActionScriptContext,
  endWorkflowActionScriptContext,
  takeWorkflowScriptDirectives
} from './workflowScriptContext';
import type { WorkflowRunnerLogEntry, WorkflowRunnerOptions, WorkflowRunnerResult } from './types';

/**
 * Default wait used when the host does not supply {@link WorkflowRunnerOptions.waitMs}.
 *
 * @param ms - Milliseconds to sleep.
 * @returns Always true after the timer fires.
 */
function defaultWaitMs(ms: number): Promise<boolean> {
  if (ms <= 0) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), ms);
  });
}

/**
 * Returns whether a request.send play result should count as a failure.
 *
 * Matches collection CLI semantics: transport error, HTTP ≥400, or failed tests.
 *
 * @param playResult - Value returned by the executor for a request.send step.
 * @returns True when the step failed.
 */
export function isWorkflowSendFailure(playResult: unknown): boolean {
  if (playResult == null || typeof playResult !== 'object') {
    return false;
  }
  const result = playResult as {
    response?: SendResult;
    testResults?: ScriptTestResult[];
  };
  const response = result.response;
  if (response == null) {
    return false;
  }
  if (response.error) {
    return true;
  }
  if (response.status >= 400) {
    return true;
  }
  const tests = result.testResults;
  if (Array.isArray(tests) && tests.some((test) => !test.passed)) {
    return true;
  }
  return false;
}

/**
 * Runs a workflow action list through a pluggable executor.
 *
 * Owns cursor advancement, inter-step delay, gapless/gapped timing, workflow
 * script context, next-action directives, and run-log / export assembly.
 *
 * @param options - Actions, executor, and run controls.
 * @returns Run outcome including export envelope and failure count.
 */
export async function runWorkflow(options: WorkflowRunnerOptions): Promise<WorkflowRunnerResult> {
  const actions = options.actions;
  const delayMs =
    typeof options.delayMs === 'number' && Number.isFinite(options.delayMs) && options.delayMs > 0
      ? Math.floor(options.delayMs)
      : 0;
  const gapless = options.gapless !== false;
  const stopOnFailure = options.stopOnFailure === true;
  const waitMs = options.waitMs ?? defaultWaitMs;
  const shouldStop = options.shouldStop ?? (() => false);
  const dateCreated = options.dateCreated ?? new Date().toISOString();
  const environmentUuid =
    typeof options.environmentUuid === 'string' ? options.environmentUuid : '';

  let index =
    typeof options.startIndex === 'number' && Number.isFinite(options.startIndex)
      ? Math.min(Math.max(Math.floor(options.startIndex), 0), actions.length)
      : 0;

  const entries: WorkflowRunnerLogEntry[] = [];
  let failures = 0;
  let stoppedEarly = false;
  let stoppedOnFailure = false;
  let error: unknown;

  const startIndex = index;
  const baseAt = actions[startIndex]?.at;
  const segmentWallStart = Date.now();

  /**
   * Notifies the host of the current cursor.
   */
  const notifyIndex = (): void => {
    options.onIndexChange?.(index);
  };

  notifyIndex();

  try {
    while (index < actions.length) {
      if (shouldStop()) {
        stoppedEarly = true;
        break;
      }

      const action = actions[index];
      if (action == null) {
        break;
      }

      if (!gapless && typeof baseAt === 'number' && typeof action.at === 'number') {
        const targetDelay = action.at - baseAt;
        const elapsed = Date.now() - segmentWallStart;
        const waitFor = Math.max(0, targetDelay - elapsed);
        const completed = await waitMs(waitFor);
        if (!completed || shouldStop()) {
          stoppedEarly = true;
          break;
        }
      }

      beginWorkflowActionScriptContext({
        workflowId: options.workflowUuid,
        workflowActionId: action.uuid,
        workflowActionIteration: index
      });
      const stepStartedAt = Date.now();
      const ranAt = new Date(stepStartedAt).toISOString();
      let playResult: unknown;
      try {
        playResult = await options.executor.play(action, index);
      } finally {
        endWorkflowActionScriptContext();
      }
      const durationMs = Math.max(0, Date.now() - stepStartedAt);

      if (shouldStop()) {
        stoppedEarly = true;
        break;
      }

      const mapped = options.resolveLogResult?.(action, playResult);
      const result =
        mapped !== undefined ? mapped : (action.payload as WorkflowRunnerLogEntry['result']);
      const entry: WorkflowRunnerLogEntry = {
        action: { ...action },
        result,
        ranAt,
        durationMs
      };
      entries.push(entry);
      options.onStepComplete?.(entry, index);

      if (action.type === 'request.send' && isWorkflowSendFailure(playResult)) {
        failures += 1;
        if (stopOnFailure) {
          stoppedOnFailure = true;
          index += 1;
          notifyIndex();
          break;
        }
      }

      const directives = options.workflowUuid ? takeWorkflowScriptDirectives() : {};
      const nextIndex = resolveWorkflowNextIndex(actions, index, directives.workflowNextAction);
      if (nextIndex === null) {
        index = actions.length;
        notifyIndex();
        break;
      }

      if (delayMs > 0 && nextIndex < actions.length) {
        const completed = await waitMs(delayMs);
        if (!completed || shouldStop()) {
          index = nextIndex;
          notifyIndex();
          stoppedEarly = true;
          break;
        }
      }

      index = nextIndex;
      notifyIndex();
    }
  } catch (err) {
    error = err;
  }

  const completed =
    error == null &&
    !stoppedEarly &&
    !stoppedOnFailure &&
    index >= actions.length &&
    actions.length > 0;

  return {
    completed,
    stoppedEarly,
    stoppedOnFailure,
    lastIndex: index,
    failures,
    ...(error !== undefined ? { error } : {}),
    export: buildWorkflowRunExport({
      name: options.workflowName,
      environment: environmentUuid,
      date_created: dateCreated,
      actions: entries.map((entry, stepIndex) => ({
        index: stepIndex + 1,
        ranAt: entry.ranAt,
        durationMs: entry.durationMs,
        result: entry.result
      }))
    }),
    entries
  };
}
