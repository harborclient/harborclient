import type { ScriptPhase, ScriptStage } from '@harborclient/sdk';
import type { AuthConfig } from '../auth';
import type { BodyType, HttpMethod, KeyValue } from './common';
import type { SendResult } from './request';

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
 * Ephemeral script payload stored in the in-memory clipboard for copy/paste.
 *
 * Inline rows copy code, name, enabled, and stage. Snippet rows copy only the
 * library uuid so pasted rows stay linked to the live snippet entry.
 */
export type CopiedScriptRef =
  | {
      kind: 'inline';
      code: string;
      name?: string;
      enabled: boolean;
      stage: ScriptStage;
    }
  | {
      kind: 'snippet';
      snippetUuid: string;
    };

/**
 * Request context passed into a pre/post script sandbox.
 */
export interface ScriptRequestContext {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  /**
   * Request-level User-Agent override; empty inherits folder → collection → global.
   */
  userAgent?: string;
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
 * Folder context passed into a pre/post script sandbox.
 */
export interface ScriptFolderContext {
  /**
   * Folder database id, or null when the request is not in a folder.
   */
  id: number | null;
  /**
   * Display name of the folder, or empty when none is associated.
   */
  name: string;
  /**
   * Raw folder headers (unsubstituted {{var}} values).
   */
  headers: KeyValue[];
  /**
   * Folder-level auth config; mutated by hc.folder.auth during script execution.
   */
  auth?: AuthConfig;
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
   * Storage connection id when the collection is backed by a mounted provider.
   * Used to confine hc.fs to the git repository directory for git collections.
   */
  connectionId?: string | null;
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

  /**
   * UUID of the workflow being played, or empty when not in a workflow.
   */
  workflowId: string;

  /**
   * UUID of the workflow action currently executing, or empty when not in a workflow.
   */
  workflowActionId: string;

  /**
   * 0-based index of the workflow action currently executing, or -1 when not in a workflow.
   */
  workflowActionIteration: number;

  /**
   * UUID of the live page (website) for this script run, or empty when not a live page.
   */
  livepageId: string;

  /**
   * Saved live server database id as a string, or empty when not a live-server script run.
   */
  liveserverId: string;
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
 * @param options - Request identity, optional collection-run iteration, and optional workflow context.
 * @returns Read-only info snapshot for the sandbox.
 */
export function buildScriptRunInfo(
  phase: ScriptPhase,
  options: {
    requestName?: string;
    requestId?: number | null;
    iteration?: number;
    workflowId?: string;
    workflowActionId?: string;
    workflowActionIteration?: number;
    livepageId?: string | null;
    /**
     * Saved live server id, or empty/omitted when not a live-server script run.
     */
    liveserverId?: string | number | null;
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
  const workflowId = typeof options.workflowId === 'string' ? options.workflowId.trim() : '';
  const workflowActionId =
    typeof options.workflowActionId === 'string' ? options.workflowActionId.trim() : '';
  const workflowActionIteration =
    typeof options.workflowActionIteration === 'number' &&
    Number.isFinite(options.workflowActionIteration) &&
    options.workflowActionIteration >= 0
      ? Math.floor(options.workflowActionIteration)
      : -1;
  const livepageId = typeof options.livepageId === 'string' ? options.livepageId.trim() : '';
  const liveserverId =
    typeof options.liveserverId === 'number' && Number.isFinite(options.liveserverId)
      ? String(options.liveserverId)
      : typeof options.liveserverId === 'string'
        ? options.liveserverId.trim()
        : '';

  return {
    eventName: scriptEventNameFromPhase(phase),
    requestName,
    requestId,
    iteration,
    workflowId,
    workflowActionId,
    workflowActionIteration,
    livepageId,
    liveserverId
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
   * Active folder metadata and headers when the request belongs to a folder.
   */
  folder?: ScriptFolderContext;
  /**
   * Active environment metadata when an environment is selected.
   */
  environment?: ScriptEnvironmentContext;
  /**
   * Cookies for the request host resolved at send start, seeded from the cookie jar.
   */
  cookies?: KeyValue[];
  /**
   * Mutable object bag threaded across sequential scripts within one send.
   */
  data?: Record<string, unknown>;

  /**
   * Importable snippet sources keyed by filename (for example `utils/foo.js`).
   *
   * Populated at send time from the snippet library for relative `import`
   * resolution during script bundling.
   */
  snippetModules?: Record<string, string>;

  /**
   * Snippet filenames that appear on more than one library row.
   *
   * When a script imports one of these names, bundling fails with an
   * ambiguous-import error instead of picking an arbitrary snippet.
   */
  snippetModuleConflicts?: string[];
}

/**
 * Variable scope for execution log entries emitted by the script sandbox.
 */
export type ScriptExecutionVariableScope =
  | 'request'
  | 'collection'
  | 'folder'
  | 'environment'
  | 'global';

/**
 * Variable mutation action recorded in the execution log.
 */
export type ScriptExecutionVariableAction = 'set' | 'update' | 'clear';

/**
 * Flow-control action recorded in the execution log.
 */
export type ScriptExecutionFlowAction =
  | 'set-next-request'
  | 'skip-request'
  | 'send-response'
  | 'workflow-next-action'
  | 'workflow-skip-action';

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
       * Target workflow action UUID for workflow-next-action.
       */
      workflowNextAction?: string;
      /**
       * HTTP status code when action is send-response (hc.send / hc.sendJSON).
       */
      status?: number;
      /**
       * Display label of the pre/post script that produced this event.
       */
      scriptName?: string;
    };

/**
 * Synthetic HTTP response supplied by hc.send or hc.sendJSON during a script run.
 *
 * When present on {@link ScriptRunResult}, the request runner replaces the real
 * (or skipped) SendResult status, headers, and body with these values.
 */
export interface ScriptResponseOverride {
  /**
   * HTTP status code (100–599).
   */
  status: number;
  /**
   * Reason phrase for {@link ScriptResponseOverride.status}.
   */
  statusText: string;
  /**
   * Response headers (keys lowercased to match Requester).
   */
  headers: Record<string, string>;
  /**
   * Response body text.
   */
  body: string;
}

/**
 * Ownership scope of the script slot that produced a test result.
 *
 * `plugin` rows are injected at send time and have no editor row to navigate to.
 */
export type ScriptTestScope = 'collection' | 'folder' | 'request' | 'plugin';

/**
 * Severity of a captured script console line.
 *
 * - `log` — console.log, console.debug, console.trace, and similar
 * - `error` — console.error and failed console.assert
 * - `warn` — console.warn and timer misuse warnings
 */
export type ScriptLogLevel = 'log' | 'error' | 'warn';

/**
 * Console API method that produced a captured log line.
 */
export type ScriptConsoleMethod =
  | 'log'
  | 'error'
  | 'warn'
  | 'debug'
  | 'assert'
  | 'group'
  | 'groupCollapsed'
  | 'table'
  | 'time'
  | 'timeEnd'
  | 'timeLog'
  | 'trace';

/**
 * Renderer component id for a console method (JSX lives in the GUI; core only stores the id).
 */
export type ScriptConsoleComponent = 'log' | 'table' | 'trace';

/**
 * Structured tabular payload for console.table (cells already stringified).
 */
export interface ScriptConsoleTableData {
  /**
   * Column headers; typically starts with `(index)`.
   */
  columns: string[];
  /**
   * Body rows parallel to {@link columns}.
   */
  rows: string[][];
}

/**
 * One console line from the sandbox before host script metadata is attached.
 */
export interface ScriptLogLine {
  /**
   * Formatted message text (objects pretty-printed at capture time).
   * Also used as an ASCII/export fallback for table lines.
   */
  message: string;
  /**
   * Display severity for styling and export prefixes.
   */
  level: ScriptLogLevel;
  /**
   * Which console API method produced this line.
   */
  method: ScriptConsoleMethod;
  /**
   * Structured table when {@link method} is `table`.
   */
  table?: ScriptConsoleTableData;
}

/**
 * Host-enriched console line with script ownership for jump-to-editor.
 */
export interface ScriptLogEntry {
  /**
   * Formatted message text (objects pretty-printed at capture time).
   * Also used as an ASCII/export fallback for table lines.
   */
  message: string;
  /**
   * Display severity for styling and export prefixes.
   */
  level: ScriptLogLevel;
  /**
   * Which console API method produced this line.
   */
  method: ScriptConsoleMethod;
  /**
   * Structured table when {@link method} is `table`.
   */
  table?: ScriptConsoleTableData;
  /**
   * Display label of the pre/post script that produced this line.
   */
  scriptName: string;
  /**
   * Stable {@link ScriptRef.id} of the slot that produced this line (host-filled).
   */
  scriptId?: string;
  /**
   * Script phase that produced this line (host-filled).
   */
  phase?: ScriptPhase;
  /**
   * Collection / folder / request ownership of the slot (host-filled).
   */
  scope?: ScriptTestScope;
}

/**
 * Result of a single hc.test assertion.
 */
export interface ScriptTestResult {
  name: string;
  passed: boolean;
  error?: string;
  /**
   * Chai AssertionError.expected coerced to string when the failure exposed one.
   */
  expected?: string;
  /**
   * Chai AssertionError.actual coerced to string when the failure exposed one.
   */
  actual?: string;
  /**
   * Mapped original file from the compile sourcemap (`script.js` or snippet path).
   *
   * Locations refer to the compiled input (post variable substitution), which can
   * differ from the editor buffer when multi-line `{{var}}` expansions shift lines.
   */
  source?: string;
  /**
   * 1-based mapped line of the failing assertion, when a stack frame remapped.
   */
  line?: number;
  /**
   * 1-based mapped column of the failing assertion, when a stack frame remapped.
   */
  column?: number;
  /**
   * Wall-clock duration of the test callback in milliseconds.
   */
  durationMs?: number;
  /**
   * Stable {@link ScriptRef.id} of the slot that produced this assertion (host-filled).
   */
  scriptId?: string;
  /**
   * Script phase that ran this assertion (host-filled).
   */
  phase?: ScriptPhase;
  /**
   * Collection / folder / request ownership of the slot (host-filled).
   */
  scope?: ScriptTestScope;
  /**
   * Display label of the pre/post script that produced this assertion.
   */
  scriptName?: string;
}

/**
 * Source-mapped location of a script runtime or compile error.
 *
 * Structurally identical to the sourcemap module's ScriptOriginalLocation, but
 * declared here so renderer-facing types stay free of `node:module` imports.
 */
export interface ScriptErrorLocation {
  /**
   * Mapped original file from the compile sourcemap (`script.js` or snippet path).
   *
   * Locations refer to the compiled input (post variable substitution), which can
   * differ from the editor buffer when multi-line `{{var}}` expansions shift lines.
   */
  source: string;
  /**
   * 1-based mapped line of the error.
   */
  line: number;
  /**
   * 1-based mapped column of the error.
   */
  column: number;
}

/**
 * One script runtime or compile failure tagged with slot metadata by the host.
 *
 * Mirrors the location and ownership fields on {@link ScriptTestResult} so
 * errors can flow through the same jump-to-editor reveal pipeline as failed
 * assertions.
 */
export interface ScriptRunError {
  /**
   * Sanitized single-line error text, including any `source:line:column:` prefix.
   */
  message: string;
  /**
   * Display label of the pre/post script slot that failed (host-filled).
   */
  scriptName?: string;
  /**
   * Stable {@link ScriptRef.id} of the slot that failed (host-filled).
   */
  scriptId?: string;
  /**
   * Script phase that failed (host-filled).
   */
  phase?: ScriptPhase;
  /**
   * Collection / folder / request ownership of the slot (host-filled).
   */
  scope?: ScriptTestScope;
  /**
   * Mapped original file, when the error location resolved through sourcemaps.
   */
  source?: string;
  /**
   * 1-based mapped line of the error, when resolvable.
   */
  line?: number;
  /**
   * 1-based mapped column of the error, when resolvable.
   */
  column?: number;
}

/**
 * Result returned from the script sandbox after execution.
 */
export interface ScriptRunResult {
  request: ScriptRequestContext;
  variableSets: Record<string, string>;
  /**
   * Keys removed via hc.request.variables.clear during this script run (runtime-only, not persisted).
   * Entries may be exact keys or `namespace.*` patterns.
   */
  variableClears: string[];
  /**
   * Values set via hc.collection.variables.set; persisted to the collection after send.
   */
  collectionVariableSets: Record<string, string>;
  /**
   * Keys removed via hc.collection.variables.clear; persisted to the collection after send.
   * Entries may be exact keys or `namespace.*` patterns.
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
   * Values set via hc.folder.variables.set; persisted to the folder after send.
   */
  folderVariableSets: Record<string, string>;
  /**
   * Keys removed via hc.folder.variables.clear; persisted to the folder after send.
   * Entries may be exact keys or `namespace.*` patterns.
   */
  folderVariableClears: string[];
  /**
   * Folder headers after hc.folder.headers mutations; persisted after send.
   */
  folderHeaders: KeyValue[];
  /**
   * Folder auth after hc.folder.auth mutations; persisted after send.
   */
  folderAuth?: AuthConfig;
  /**
   * Values set via hc.environment.variables.set; persisted to the active environment after send.
   */
  environmentVariableSets: Record<string, string>;
  /**
   * Keys removed via hc.environment.variables.clear; persisted to the active environment after send.
   * Entries may be exact keys or `namespace.*` patterns.
   */
  environmentVariableClears: string[];
  /**
   * Values set via hc.globals.set; persisted to app global variables after send.
   */
  globalVariableSets: Record<string, string>;
  /**
   * Keys removed via hc.globals.clear; persisted to app global variables after send.
   * Entries may be exact keys or `namespace.*` patterns.
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
  /**
   * When set via hc.send / hc.sendJSON, replaces the HTTP response for this send.
   * Last call in the phase wins; does not skip the send by itself.
   */
  responseOverride?: ScriptResponseOverride;
  /**
   * When set via hc.execution.workflowNextAction, UUID of the next workflow action to play.
   * Undefined means no directive was issued.
   */
  workflowNextAction?: string;
  /**
   * When true via hc.execution.workflowSkipAction(), the current workflow action should be skipped.
   */
  workflowSkipAction?: boolean;
  tests: ScriptTestResult[];
  /**
   * Console lines captured during this script run (no host script metadata yet).
   */
  logs: ScriptLogLine[];
  /**
   * Ordered variable and flow-control activity emitted during this script run.
   */
  executionEvents: ScriptExecutionEvent[];
  /**
   * Mutable object bag after this script run, forwarded to the next script slot.
   */
  data: Record<string, unknown>;
  error?: string;
  /**
   * Source-mapped location of {@link ScriptRunResult.error}, when the failing
   * stack frame or compile diagnostic resolved to user source.
   */
  errorLocation?: ScriptErrorLocation;
}
