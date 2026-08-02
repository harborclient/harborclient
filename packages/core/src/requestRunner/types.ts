import type { ScriptStage } from '@harborclient/sdk';
import type { AuthConfig, OAuthFetchTokenResult } from '../auth';
import type { ICookieJar, IScriptRunner, PluginHooks, SettingsProvider } from '../interfaces';
import type {
  Collection,
  Folder,
  GeneralSettings,
  KeyValue,
  ScriptExecutionEvent,
  ScriptLogEntry,
  ScriptRequestContext,
  ScriptTestResult,
  SendRequestInput,
  SendResult,
  Variable
} from '../types';

/**
 * A script source resolved by the host from a request, folder, collection, or snippet.
 */
export interface RequestRunnerScript {
  /**
   * Phase in which the source is evaluated.
   */
  phase: 'pre' | 'post';

  /**
   * User-facing script name for logs and test results.
   */
  label: string;

  /**
   * JavaScript source ready for execution.
   */
  source: string;

  /**
   * Stable script list id when the host can navigate back to an editor.
   */
  scriptId?: string;

  /**
   * Ownership scope of the script list this entry came from.
   *
   * `plugin` rows are injected at send time and have no editor row.
   */
  scope?: 'collection' | 'folder' | 'request' | 'plugin';

  /**
   * Stage within the phase list, used when merging plugin-injected scripts.
   */
  stage?: ScriptStage;

  /**
   * Injecting plugin id, set only when {@link scope} is `plugin`.
   */
  pluginId?: string;
}

/**
 * Functions used to persist mutations made by request scripts.
 */
export interface RequestRunnerPersistence {
  /**
   * Persists cookie rows after scripts update the current request host.
   */
  saveCookies?(domain: string, cookies: KeyValue[]): Promise<void> | void;
}

/**
 * Dependencies supplied by a GUI, CLI, or another host.
 */
export interface RequestRunnerDeps {
  /**
   * Provides general settings to hosts that use the built-in HTTP transport.
   */
  settings: SettingsProvider | GeneralSettings;

  /**
   * Executes an already-prepared HTTP request.
   */
  transport: (request: SendRequestInput, signal?: AbortSignal) => Promise<SendResult>;

  /**
   * Evaluates request scripts when scripts are included in the input.
   */
  scriptRunner?: IScriptRunner;

  /**
   * Supplies script-visible cookies and supports browser-independent persistence.
   */
  cookieJar: ICookieJar;

  /**
   * Fetches an OAuth token for an inherited or request-level OAuth configuration.
   */
  fetchOAuthToken?: (
    cacheKey: string,
    config: AuthConfig['oauth2']
  ) => Promise<OAuthFetchTokenResult>;

  /**
   * Optional plugin hooks owned by the host when its transport does not apply them itself.
   */
  pluginHooks?: PluginHooks;

  /**
   * Persists optional side effects emitted by scripts.
   */
  persistence?: RequestRunnerPersistence;
}

/**
 * Input needed to execute a request independently of a UI state container.
 */
export interface RunRequestInput {
  /**
   * Mutable request context that scripts may change before send.
   */
  request: ScriptRequestContext;

  /**
   * Request identity used for OAuth caching and source attribution.
   */
  requestIdentity?: {
    id?: number;
    name?: string;
    bodyRaw?: string | null;
  };

  /**
   * Lower-precedence global variables.
   */
  globalVariables?: Variable[];

  /**
   * Collection context providing inherited variables, headers, and auth.
   */
  collection?: Pick<
    Collection,
    | 'id'
    | 'name'
    | 'connectionId'
    | 'variables'
    | 'headers'
    | 'userAgent'
    | 'auth'
    | 'pre_request_script'
    | 'post_request_script'
  >;

  /**
   * Folder context overriding collection variables, headers, and auth.
   */
  folder?: Pick<
    Folder,
    | 'id'
    | 'name'
    | 'variables'
    | 'headers'
    | 'userAgent'
    | 'auth'
    | 'pre_request_script'
    | 'post_request_script'
  >;

  /**
   * Highest-precedence environment variables.
   */
  environment?: {
    name?: string;
    variables: Variable[];
  };

  /**
   * Host-resolved scripts, ordered within each phase.
   */
  scripts?: RequestRunnerScript[];

  /**
   * Optional OAuth cache namespace override.
   */
  oauthCacheKey?: string;

  /**
   * Cancellation signal forwarded to the transport.
   */
  signal?: AbortSignal;

  /**
   * Workflow playback identity for hc.info when running inside a workflow.
   */
  workflow?: {
    workflowId?: string;
    workflowActionId?: string;
    workflowActionIteration?: number;
  };
}

/**
 * Portable output from an HTTP request run.
 */
export interface RunRequestResult {
  /**
   * HTTP response or a synthetic skipped/error response.
   */
  response: SendResult;

  /**
   * Fully substituted request payload passed to the transport when sent.
   */
  sendInput?: SendRequestInput;

  /**
   * Assertion results returned by post-request scripts.
   */
  testResults: ScriptTestResult[];

  /**
   * Script console messages with host-filled script ownership metadata.
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Ordered script variable and flow-control events.
   */
  executionEvents: ScriptExecutionEvent[];

  /**
   * Joined script errors without converting a successful HTTP response to an error.
   */
  scriptError?: string;

  /**
   * Collection runner target set by a script, when any.
   */
  scriptNextRequest?: string | null;

  /**
   * True when a pre-request script skipped transport execution.
   */
  scriptSkipRequest: boolean;

  /**
   * When set via hc.execution.workflowNextAction during this run.
   */
  workflowNextAction?: string;

  /**
   * When true via hc.execution.workflowSkipAction during this run.
   */
  workflowSkipAction?: boolean;
}
