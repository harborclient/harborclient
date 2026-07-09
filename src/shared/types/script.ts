import type { ScriptPhase, ScriptStage } from '@harborclient/sdk';
import type { AuthConfig } from '#/shared/auth';
import type { BodyType, HttpMethod, KeyValue } from '#/shared/types/common';
import type { SendResult } from '#/shared/types/request';

/**
 * A single script entry in an ordered pre-request or post-request stage script list.
 */
export interface ScriptRef {
  /**
   * Stable list key used for reordering and React keys.
   */
  id: string;

  /**
   * When false, the script is skipped at send time.
   */
  enabled: boolean;

  /**
   * Inline JavaScript source or a live reference to a saved snippet.
   */
  kind: 'inline' | 'snippet';

  /**
   * Optional display label for inline scripts.
   */
  name?: string;

  /**
   * JavaScript source when {@link kind} is `inline`.
   */
  code?: string;

  /**
   * Snippet {@link Snippet.uuid} when {@link kind} is `snippet`.
   */
  snippetUuid?: string;

  /**
   * When true, the script editor body is expanded in the list UI.
   */
  expanded?: boolean;

  /**
   * Stage controlling when the script runs within its request stage list.
   * Defaults to `run` when omitted for legacy rows.
   */
  stage?: ScriptStage;
}

/**
 * Request context passed into a pre/post script sandbox.
 */
export interface ScriptRequestContext {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: BodyType;
  /**
   * Request-level auth config; mutated by hc.request.auth during script execution.
   */
  auth?: AuthConfig;
  /**
   * Comma-separated request tags; mutated by hc.request.notes during script execution.
   */
  tags?: string;
  /**
   * Free-form request comment; mutated by hc.request.notes during script execution.
   */
  comment?: string;
}

/**
 * Collection context passed into a pre/post script sandbox.
 */
export interface ScriptCollectionContext {
  /**
   * Collection database id, or null when the request has no collection.
   */
  id: number | null;
  /**
   * Display name of the collection, or empty when none is associated.
   */
  name: string;
  /**
   * Raw collection headers (unsubstituted {{var}} values).
   */
  headers: KeyValue[];
  /**
   * Collection-level auth config; mutated by hc.collection.auth during script execution.
   */
  auth?: AuthConfig;
}

/**
 * Environment context passed into a pre/post script sandbox.
 */
export interface ScriptEnvironmentContext {
  /**
   * Active environment display name, or empty when none is active.
   */
  name: string;
}

/**
 * Postman-compatible script execution metadata exposed as hc.info.
 */
export interface ScriptRunInfo {
  /**
   * Event that triggered the script: prerequest or test (post-request).
   */
  eventName: 'prerequest' | 'test';

  /**
   * Display name of the request being sent.
   */
  requestName: string;

  /**
   * Saved request database id as a string, or empty when the tab is unsaved.
   */
  requestId: string;

  /**
   * Collection run iteration index (0 when not data-driven); always 0 for manual sends today.
   */
  iteration: number;
}

/**
 * Maps a HarborClient script phase to Postman's pm.info.eventName values.
 *
 * @param phase - Pre- or post-request script phase.
 * @returns Postman-compatible event name.
 */
export function scriptEventNameFromPhase(phase: ScriptPhase): ScriptRunInfo['eventName'] {
  return phase === 'pre' ? 'prerequest' : 'test';
}

/**
 * Builds hc.info metadata for a script run.
 *
 * @param phase - Pre- or post-request script phase.
 * @param options - Request identity and optional collection-run iteration.
 * @returns Read-only info snapshot for the sandbox.
 */
export function buildScriptRunInfo(
  phase: ScriptPhase,
  options: {
    requestName?: string;
    requestId?: number | null;
    iteration?: number;
  } = {}
): ScriptRunInfo {
  const requestName = typeof options.requestName === 'string' ? options.requestName.trim() : '';
  const requestId =
    options.requestId != null && Number.isFinite(options.requestId)
      ? String(options.requestId)
      : '';
  const iteration =
    typeof options.iteration === 'number' &&
    Number.isFinite(options.iteration) &&
    options.iteration >= 0
      ? Math.floor(options.iteration)
      : 0;

  return {
    eventName: scriptEventNameFromPhase(phase),
    requestName,
    requestId,
    iteration
  };
}

/**
 * Input for running a pre/post script in the main process sandbox.
 */
export interface ScriptRunInput {
  phase: ScriptPhase;
  script: string;
  request: ScriptRequestContext;
  response?: SendResult;
  variables: Record<string, string>;
  /**
   * Postman-compatible execution metadata for hc.info.
   */
  info?: ScriptRunInfo;
  /**
   * Active collection metadata and headers when the request belongs to a collection.
   */
  collection?: ScriptCollectionContext;
  /**
   * Active environment metadata when an environment is selected.
   */
  environment?: ScriptEnvironmentContext;
  /**
   * Cookies for the request host resolved at send start, seeded from the cookie jar.
   */
  cookies?: KeyValue[];
}

/**
 * Variable scope for execution log entries emitted by the script sandbox.
 */
export type ScriptExecutionVariableScope = 'request' | 'collection' | 'environment' | 'global';

/**
 * Variable mutation action recorded in the execution log.
 */
export type ScriptExecutionVariableAction = 'set' | 'update' | 'clear';

/**
 * Flow-control action recorded in the execution log.
 */
export type ScriptExecutionFlowAction = 'set-next-request' | 'skip-request';

/**
 * Ordered execution activity captured during a script run for the console inspector.
 */
export type ScriptExecutionEvent =
  | {
      type: 'variable';
      scope: ScriptExecutionVariableScope;
      action: ScriptExecutionVariableAction;
      key: string;
      value?: string;
      /**
       * Display label of the pre/post script that produced this event.
       */
      scriptName?: string;
    }
  | {
      type: 'flow';
      action: ScriptExecutionFlowAction;
      /**
       * Target request name for set-next-request, or null when the run should stop.
       */
      nextRequest?: string | null;
      /**
       * Display label of the pre/post script that produced this event.
       */
      scriptName?: string;
    };

/**
 * Result of a single hc.test assertion.
 */
export interface ScriptTestResult {
  name: string;
  passed: boolean;
  error?: string;
  /**
   * Display label of the pre/post script that produced this assertion.
   */
  scriptName?: string;
}

/**
 * Result returned from the script sandbox after execution.
 */
export interface ScriptRunResult {
  request: ScriptRequestContext;
  variableSets: Record<string, string>;
  /**
   * Keys removed via hc.request.variables.clear during this script run (runtime-only, not persisted).
   */
  variableClears: string[];
  /**
   * Values set via hc.collection.variables.set; persisted to the collection after send.
   */
  collectionVariableSets: Record<string, string>;
  /**
   * Keys removed via hc.collection.variables.clear; persisted to the collection after send.
   */
  collectionVariableClears: string[];
  /**
   * Collection headers after hc.collection.headers mutations; persisted after send.
   */
  collectionHeaders: KeyValue[];
  /**
   * Collection auth after hc.collection.auth mutations; persisted after send.
   */
  collectionAuth?: AuthConfig;
  /**
   * Values set via hc.environment.variables.set; persisted to the active environment after send.
   */
  environmentVariableSets: Record<string, string>;
  /**
   * Keys removed via hc.environment.variables.clear; persisted to the active environment after send.
   */
  environmentVariableClears: string[];
  /**
   * Values set via hc.globals.set; persisted to app global variables after send.
   */
  globalVariableSets: Record<string, string>;
  /**
   * Keys removed via hc.globals.clear; persisted to app global variables after send.
   */
  globalVariableClears: string[];
  /**
   * Cookie values set via hc.cookies.set for the request host resolved at send start.
   */
  cookieSets: Record<string, string>;
  /**
   * Cookie names removed via hc.cookies.clear for the request host resolved at send start.
   */
  cookieClears: string[];
  /**
   * When set via hc.execution.setNextRequest, names the next request in a collection run.
   * Null stops the run; undefined means no directive was issued.
   */
  nextRequest?: string | null;
  /**
   * When true via hc.execution.skipRequest(), the current request send should be skipped.
   */
  skipRequest?: boolean;
  tests: ScriptTestResult[];
  logs: string[];
  /**
   * Ordered variable and flow-control activity emitted during this script run.
   */
  executionEvents: ScriptExecutionEvent[];
  error?: string;
}
