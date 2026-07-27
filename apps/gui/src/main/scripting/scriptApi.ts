import type {
  BodyType,
  KeyValue,
  ScriptExecutionEvent,
  ScriptExecutionVariableScope,
  ScriptPhase,
  ScriptRequestContext,
  ScriptRunInfo,
  ScriptRunInput,
  ScriptRunResult,
  ScriptTestResult,
  SendRequestInput,
  SendResult
} from '@harborclient/core/types';
import { buildScriptRunInfo } from '@harborclient/core/types/script';
import {
  applyScriptAuthSet,
  applyScriptAuthUpdate,
  defaultAuth,
  flattenAuthConfig,
  normalizeAuth,
  type AuthConfig
} from '@harborclient/core/auth';
import {
  resolveDynamicVariable,
  substituteVariablesWithResolver
} from '@harborclient/sdk/variables';
import { parseResponseDocument, type ScriptDocumentFacade } from './scriptResponseDocument';
import { scriptExpect } from './scriptExpect';
import { createResponseAssertionSubject } from './scriptResponseAssertions';
import type {
  ScriptCsvOptions,
  ScriptFileRequest,
  ScriptJsonWriteOptions
} from './scriptFileOperations';
import { resolveStackToOriginalLocation, type ScriptCompileMap } from './scriptSourceMap';

/**
 * Context fields passed into the hc sandbox without user script source.
 */
export type ScriptRunContextInput = Omit<ScriptRunInput, 'script'>;

/**
 * Payload for {@link ScriptApiOptions.ask} / `hc.ask` bridge calls.
 */
export interface ScriptAskRequest {
  /**
   * Text sent to the selected AI model.
   */
  prompt: string;

  /**
   * Optional model selection: `"model"`, `"model: source"`, or omitted for the
   * first available model. Source is a group label such as `Personal` or a Team Hub name.
   */
  model?: string;
}

/**
 * Optional runtime hooks injected when building the hc API.
 */
export interface ScriptApiOptions {
  /**
   * When provided, enables hc.sendRequest for outbound HTTP from the script sandbox.
   */
  sendRequest?: (req: SendRequestInput) => Promise<SendResult>;

  /**
   * When provided, enables hc.fs / hc.parse / hc.stringify via the main-process bridge.
   */
  fileBridge?: (req: ScriptFileRequest) => Promise<unknown>;

  /**
   * When provided, enables hc.ask for one-shot AI completions from the script sandbox.
   * When omitted, hc.ask resolves to null (AI not available in this context).
   */
  ask?: (req: ScriptAskRequest) => Promise<string | null>;

  /**
   * Compile sourcemap chain from evaluateScript used to remap assertion stacks
   * to user or snippet source lines.
   */
  compileMaps?: ScriptCompileMap[];
}

/**
 * Mutable sandbox state mutated by hc APIs during script execution.
 */
interface ScriptApiState {
  request: ScriptRequestContext;
  variables: Record<string, string>;
  variableSets: Record<string, string>;
  variableClears: Set<string>;
  collectionVariableSets: Record<string, string>;
  collectionVariableClears: Set<string>;
  folderVariableSets: Record<string, string>;
  folderVariableClears: Set<string>;
  environmentVariableSets: Record<string, string>;
  environmentVariableClears: Set<string>;
  globalVariableSets: Record<string, string>;
  globalVariableClears: Set<string>;
  cookies: KeyValue[];
  cookieSets: Record<string, string>;
  cookieClears: Set<string>;
  collectionHeaders: KeyValue[];
  collectionAuth: AuthConfig;
  folderHeaders: KeyValue[];
  folderAuth: AuthConfig;
  tests: ScriptTestResult[];
  logs: string[];
  executionEvents: ScriptExecutionEvent[];
  phase: ScriptPhase;
  nextRequest: string | null | undefined;
  skipRequest: boolean;
  data: Record<string, unknown>;
}

/**
 * hc API surface and capturing console built for one script run or plugin context.
 */
export interface ScriptApi {
  /**
   * HarborClient script API exposed inside the SES compartment.
   */
  hc: Record<string, unknown>;

  /**
   * Capturing console that appends formatted lines to sandbox logs.
   */
  console: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };

  /**
   * Snapshots the current mutable state into a {@link ScriptRunResult}.
   *
   * @returns Request mutations, variable sets, tests, and logs accumulated so far.
   */
  readResult(): ScriptRunResult;
}

/**
 * Builds a variable bag with get, set, and clear keyed by name.
 *
 * @param scope - Variable scope label recorded in execution events.
 * @param getSets - Returns the mutable set map for this scope.
 * @param getClears - Returns the mutable clear set for this scope.
 * @param getFallback - Resolves values from the merged runtime variable map.
 * @param emit - Appends a variable execution event in call order.
 * @returns Variable bag API shared by request, collection, environment, and global scopes.
 */
function makeVariableBag(
  scope: ScriptExecutionVariableScope,
  getSets: () => Record<string, string>,
  getClears: () => Set<string>,
  getFallback: (key: string) => string | undefined,
  emit: (event: ScriptExecutionEvent) => void
): {
  get: (key: string) => string | undefined;
  set: (key: string, value: unknown) => void;
  clear: (key: string) => void;
} {
  return {
    get: (key: string) => {
      const k = String(key);
      const sets = getSets();
      if (Object.prototype.hasOwnProperty.call(sets, k)) {
        return sets[k];
      }
      if (getClears().has(k)) {
        return undefined;
      }
      return getFallback(k);
    },
    set: (key: string, value: unknown) => {
      const k = String(key);
      const sets = getSets();
      const clears = getClears();
      let priorValue: string | undefined;
      if (Object.prototype.hasOwnProperty.call(sets, k)) {
        priorValue = sets[k];
      } else if (clears.has(k)) {
        priorValue = undefined;
      } else {
        priorValue = getFallback(k);
      }

      const v = String(value);
      emit({
        type: 'variable',
        scope,
        action: priorValue !== undefined ? 'update' : 'set',
        key: k,
        value: v
      });
      clears.delete(k);
      sets[k] = v;
    },
    clear: (key: string) => {
      const k = String(key);
      emit({
        type: 'variable',
        scope,
        action: 'clear',
        key: k
      });
      delete getSets()[k];
      getClears().add(k);
    }
  };
}

/**
 * Builds a cookie bag scoped to the request host resolved at send start.
 *
 * @param getRows - Returns mutable cookie rows seeded from the jar.
 * @param getSets - Returns cookie name to value writes for persistence.
 * @param getClears - Returns cookie names cleared during the script run.
 * @returns Cookie get/set/clear API for hc.cookies.
 */
function makeCookieBag(
  getRows: () => KeyValue[],
  getSets: () => Record<string, string>,
  getClears: () => Set<string>
): {
  get: (name: string) => string | undefined;
  set: (name: string, value: unknown) => void;
  clear: (name: string) => void;
} {
  return {
    get: (name: string) => {
      const k = String(name);
      const sets = getSets();
      if (Object.prototype.hasOwnProperty.call(sets, k)) {
        return sets[k];
      }
      if (getClears().has(k)) {
        return undefined;
      }
      const row = getRows().find(
        (cookie) => cookie.enabled && cookie.key.trim().toLowerCase() === k.toLowerCase()
      );
      return row ? row.value : undefined;
    },
    set: (name: string, value: unknown) => {
      const k = String(name);
      const v = String(value);
      getClears().delete(k);
      getSets()[k] = v;
      const rows = getRows();
      const existing = rows.find(
        (cookie) => cookie.enabled && cookie.key.trim().toLowerCase() === k.toLowerCase()
      );
      if (existing) {
        existing.value = v;
      } else {
        rows.push({ key: k, value: v, enabled: true });
      }
    },
    clear: (name: string) => {
      const k = String(name);
      delete getSets()[k];
      getClears().add(k);
      const rows = getRows();
      const index = rows.findIndex((cookie) => cookie.key.trim().toLowerCase() === k.toLowerCase());
      if (index >= 0) {
        rows.splice(index, 1);
      }
    }
  };
}

/**
 * Options for {@link makeParameterBag} key matching behavior.
 */
interface ParameterBagOptions {
  /**
   * When true, get/set/clear match keys case-insensitively (headers).
   */
  caseInsensitive: boolean;
}

/**
 * Builds a parameter bag over mutable key/value rows with batch and single set.
 *
 * @param getRows - Returns the rows mutated by set and clear.
 * @param options - Whether keys are matched case-insensitively.
 * @returns Parameter bag API shared by hc.request.params, hc.request.headers, and hc.collection.headers.
 */
function makeParameterBag(
  getRows: () => KeyValue[],
  options: ParameterBagOptions
): {
  get: {
    (): Record<string, string>;
    (key: string): string | undefined;
  };
  set: {
    (entries: Record<string, unknown>): void;
    (key: string, value: unknown): void;
  };
  clear: () => void;
} {
  const normalizeKey = (key: string): string => String(key).trim();
  const keysEqual = (left: string, right: string): boolean => {
    const a = normalizeKey(left);
    const b = normalizeKey(right);
    return options.caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
  };

  const findRow = (key: string): KeyValue | undefined => {
    const rows = getRows();
    return rows.find((row) => row.enabled && keysEqual(row.key, key));
  };

  const upsert = (key: string, value: unknown): void => {
    const k = String(key);
    const v = String(value);
    const rows = getRows();
    const existing = rows.find((row) => row.enabled && keysEqual(row.key, k));
    if (existing) {
      existing.value = v;
    } else {
      rows.push({ key: k, value: v, enabled: true });
    }
  };

  const getAll = (): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const row of getRows()) {
      if (row.enabled && row.key.trim()) {
        map[row.key.trim()] = row.value;
      }
    }
    return map;
  };

  const get = ((key?: string): Record<string, string> | string | undefined => {
    if (key === undefined) {
      return getAll();
    }
    const row = findRow(key);
    return row ? row.value : undefined;
  }) as {
    (): Record<string, string>;
    (key: string): string | undefined;
  };

  const set = ((first: unknown, second?: unknown): void => {
    if (first != null && typeof first === 'object' && !Array.isArray(first)) {
      for (const [key, value] of Object.entries(first as Record<string, unknown>)) {
        upsert(key, value);
      }
      return;
    }
    upsert(String(first), second);
  }) as {
    (entries: Record<string, unknown>): void;
    (key: string, value: unknown): void;
  };

  return {
    get,
    set,
    clear: () => {
      getRows().length = 0;
    }
  };
}

/**
 * Builds a notes bag over request tags and comment fields.
 *
 * @param getRequest - Returns the mutable script request context.
 * @returns Notes get/set/clear API for hc.request.notes.
 */
function makeNotesBag(getRequest: () => ScriptRequestContext): {
  get: {
    (): { tags: string; comment: string };
    (field: 'tags' | 'comment'): string;
  };
  set: {
    (entries: { tags?: unknown; comment?: unknown }): void;
    (field: 'tags' | 'comment', value: unknown): void;
  };
  clear: () => void;
} {
  const getAll = (): { tags: string; comment: string } => {
    const request = getRequest();
    return {
      tags: request.tags ?? '',
      comment: request.comment ?? ''
    };
  };

  const get = ((field?: 'tags' | 'comment'): { tags: string; comment: string } | string => {
    const notes = getAll();
    if (field === undefined) {
      return notes;
    }
    return notes[field];
  }) as {
    (): { tags: string; comment: string };
    (field: 'tags' | 'comment'): string;
  };

  const set = ((first: unknown, second?: unknown): void => {
    const request = getRequest();
    if (first != null && typeof first === 'object' && !Array.isArray(first)) {
      const entries = first as { tags?: unknown; comment?: unknown };
      if (entries.tags !== undefined) {
        request.tags = String(entries.tags);
      }
      if (entries.comment !== undefined) {
        request.comment = String(entries.comment);
      }
      return;
    }
    const field = String(first);
    if (field === 'tags' || field === 'comment') {
      request[field] = String(second);
    }
  }) as {
    (entries: { tags?: unknown; comment?: unknown }): void;
    (field: 'tags' | 'comment', value: unknown): void;
  };

  return {
    get,
    set,
    clear: () => {
      const request = getRequest();
      request.tags = '';
      request.comment = '';
    }
  };
}

/**
 * Builds get/set/update auth helpers over a mutable auth config ref.
 *
 * @param getAuth - Returns the mutable auth config for this scope.
 * @returns Auth bag API shared by hc.request.auth and hc.collection.auth.
 */
function makeAuthApi(getAuth: () => AuthConfig): {
  get: () => ReturnType<typeof flattenAuthConfig>;
  set: (input: unknown) => void;
  update: (field: unknown, value: unknown) => void;
} {
  return {
    get: () => flattenAuthConfig(getAuth()),
    set: (input: unknown) => {
      const next = applyScriptAuthSet(getAuth(), input);
      const auth = getAuth();
      auth.type = next.type;
      auth.basic = next.basic;
      auth.bearer = next.bearer;
      auth.oauth2 = next.oauth2;
    },
    update: (field: unknown, value: unknown) => {
      const next = applyScriptAuthUpdate(getAuth(), field, value);
      const auth = getAuth();
      auth.type = next.type;
      auth.basic = next.basic;
      auth.bearer = next.bearer;
      auth.oauth2 = next.oauth2;
    }
  };
}

/**
 * Formats console arguments the same way as the legacy bootstrap string.
 *
 * @param args - Values passed to console.log or console.error.
 * @returns Single-line string joined with spaces.
 */
function formatConsoleArgs(args: unknown[]): string {
  return args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
}

/**
 * Normalizes hc.ask arguments into a bridged ask request.
 *
 * @param prompt - User prompt text.
 * @param options - Optional config object with a `model` selection string.
 * @returns Normalized ask payload for the host bridge.
 * @throws When prompt is empty, or options is provided but not a plain object.
 */
function normalizeScriptAskRequest(prompt: unknown, options?: unknown): ScriptAskRequest {
  const promptText = prompt == null ? '' : String(prompt).trim();
  if (!promptText) {
    throw new Error('hc.ask requires a prompt');
  }

  if (options == null) {
    return { prompt: promptText };
  }

  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.ask options must be an object');
  }

  const rawModel = (options as Record<string, unknown>).model;
  if (rawModel == null) {
    return { prompt: promptText };
  }

  const modelText = String(rawModel).trim();
  return modelText ? { prompt: promptText, model: modelText } : { prompt: promptText };
}

/**
 * Normalizes a script sendRequest input from the hc API into a SendRequestInput.
 *
 * @param req - User-provided request object from hc.sendRequest.
 * @returns Normalized send input for the HTTP layer.
 */
function normalizeScriptSendRequest(req: unknown): SendRequestInput {
  if (!req || typeof req !== 'object') {
    throw new Error('hc.sendRequest requires a request object');
  }

  const input = req as Record<string, unknown>;
  const method = input.method != null ? String(input.method) : 'GET';
  const url = input.url != null ? String(input.url) : '';
  if (!url.trim()) {
    throw new Error('hc.sendRequest requires a url');
  }

  const rawHeaders = input.headers;
  let headers: KeyValue[] = [];
  if (Array.isArray(rawHeaders)) {
    headers = rawHeaders.map((row) => {
      const entry = row as Record<string, unknown>;
      return {
        key: String(entry.key ?? ''),
        value: String(entry.value ?? ''),
        enabled: entry.enabled !== false
      };
    });
  } else if (rawHeaders && typeof rawHeaders === 'object') {
    headers = Object.entries(rawHeaders as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
  }

  const rawParams = input.params;
  let params: KeyValue[] = [];
  if (Array.isArray(rawParams)) {
    params = rawParams.map((row) => {
      const entry = row as Record<string, unknown>;
      return {
        key: String(entry.key ?? ''),
        value: String(entry.value ?? ''),
        enabled: entry.enabled !== false
      };
    });
  }

  const bodyTypeRaw = String(input.bodyType ?? input.body_type ?? 'none');
  const allowedBodyTypes: BodyType[] = ['none', 'json', 'text', 'multipart', 'urlencoded'];
  const bodyType = allowedBodyTypes.includes(bodyTypeRaw as BodyType)
    ? (bodyTypeRaw as BodyType)
    : 'none';

  return {
    method: method as SendRequestInput['method'],
    url,
    headers,
    params,
    body: input.body != null ? String(input.body) : '',
    bodyType
  };
}

/**
 * Builds the hc API and capturing console over a fresh mutable state.
 *
 * Shared by pre/post request scripts and main-process plugin script contexts so
 * the hc surface never drifts between runners.
 *
 * @param input - Phase, request, response, variables, and optional collection/environment context.
 * @param options - Optional runtime hooks such as hc.sendRequest, hc.fs, and hc.ask transports.
 * @returns hc object, console, and a reader for accumulated sandbox mutations.
 */
export function createScriptApi(
  input: ScriptRunContextInput,
  options?: ScriptApiOptions
): ScriptApi {
  const ctx = {
    phase: input.phase,
    request: input.request,
    response: input.response,
    variables: input.variables,
    collection: input.collection,
    environment: input.environment,
    folder: input.folder
  };

  const state: ScriptApiState = {
    request: {
      ...input.request,
      auth: normalizeAuth(input.request.auth)
    },
    variables: { ...input.variables },
    variableSets: {},
    variableClears: new Set<string>(),
    collectionVariableSets: {},
    collectionVariableClears: new Set<string>(),
    folderVariableSets: {},
    folderVariableClears: new Set<string>(),
    environmentVariableSets: {},
    environmentVariableClears: new Set<string>(),
    globalVariableSets: {},
    globalVariableClears: new Set<string>(),
    cookies: input.cookies ? input.cookies.map((cookie) => ({ ...cookie })) : [],
    cookieSets: {},
    cookieClears: new Set<string>(),
    collectionHeaders: input.collection?.headers ? [...input.collection.headers] : [],
    collectionAuth: normalizeAuth(input.collection?.auth),
    folderHeaders: input.folder?.headers ? [...input.folder.headers] : [],
    folderAuth: normalizeAuth(input.folder?.auth),
    tests: [],
    logs: [],
    executionEvents: [],
    phase: input.phase,
    nextRequest: undefined,
    skipRequest: false,
    data: input.data ? { ...input.data } : {}
  };

  const resolveRuntimeVariable = (key: string): string | undefined => {
    if (Object.prototype.hasOwnProperty.call(state.variableSets, key)) {
      return state.variableSets[key];
    }
    if (state.variableClears.has(key)) {
      return undefined;
    }
    return state.variables[key];
  };

  const resolveSeededVariable = (key: string): string | undefined => state.variables[key];

  const emitExecutionEvent = (event: ScriptExecutionEvent): void => {
    state.executionEvents.push(event);
  };

  const info: ScriptRunInfo =
    input.info ??
    buildScriptRunInfo(input.phase, {
      requestName: '',
      requestId: null,
      iteration: 0
    });

  const hc: Record<string, unknown> = {
    info: {
      get eventName() {
        return info.eventName;
      },
      get requestName() {
        return info.requestName;
      },
      get requestId() {
        return info.requestId;
      },
      get iteration() {
        return info.iteration;
      }
    },
    request: {
      get method() {
        return state.request.method;
      },
      set method(v: unknown) {
        state.request.method = String(v) as ScriptRequestContext['method'];
      },
      get url() {
        return state.request.url;
      },
      set url(v: unknown) {
        state.request.url = String(v);
      },
      get body() {
        return state.request.body;
      },
      set body(v: unknown) {
        state.request.body = String(v);
      },
      headers: makeParameterBag(() => state.request.headers, { caseInsensitive: true }),
      params: makeParameterBag(() => state.request.params, { caseInsensitive: false }),
      notes: makeNotesBag(() => state.request),
      auth: makeAuthApi(() => state.request.auth!),
      variables: {
        ...makeVariableBag(
          'request',
          () => state.variableSets,
          () => state.variableClears,
          resolveRuntimeVariable,
          emitExecutionEvent
        ),
        replaceIn: (template: unknown) => {
          const text = String(template);
          return substituteVariablesWithResolver(text, (key) => {
            if (Object.prototype.hasOwnProperty.call(state.variableSets, key)) {
              return state.variableSets[key];
            }
            if (state.variableClears.has(key)) {
              return undefined;
            }
            if (Object.prototype.hasOwnProperty.call(state.variables, key)) {
              return state.variables[key];
            }
            return resolveDynamicVariable(key);
          });
        }
      }
    },
    collection: {
      get id() {
        return ctx.collection ? ctx.collection.id : null;
      },
      get name() {
        return ctx.collection ? ctx.collection.name : '';
      },
      variables: makeVariableBag(
        'collection',
        () => state.collectionVariableSets,
        () => state.collectionVariableClears,
        resolveSeededVariable,
        emitExecutionEvent
      ),
      headers: makeParameterBag(() => state.collectionHeaders, { caseInsensitive: true }),
      auth: makeAuthApi(() => state.collectionAuth)
    },
    folder: {
      get id() {
        return ctx.folder ? ctx.folder.id : null;
      },
      get name() {
        return ctx.folder ? ctx.folder.name : '';
      },
      variables: makeVariableBag(
        'folder',
        () => state.folderVariableSets,
        () => state.folderVariableClears,
        resolveSeededVariable,
        emitExecutionEvent
      ),
      headers: makeParameterBag(() => state.folderHeaders, { caseInsensitive: true }),
      auth: makeAuthApi(() => state.folderAuth)
    },
    environment: {
      get name() {
        return ctx.environment ? ctx.environment.name : '';
      },
      variables: makeVariableBag(
        'environment',
        () => state.environmentVariableSets,
        () => state.environmentVariableClears,
        resolveSeededVariable,
        emitExecutionEvent
      )
    },
    globals: makeVariableBag(
      'global',
      () => state.globalVariableSets,
      () => state.globalVariableClears,
      resolveSeededVariable,
      emitExecutionEvent
    ),
    /**
     * Cookie bag for the request host resolved at send start. URL changes mid-script
     * do not retarget this bag.
     */
    cookies: makeCookieBag(
      () => state.cookies,
      () => state.cookieSets,
      () => state.cookieClears
    ),
    /**
     * Mutable object shared across scripts in the current send (pre through post).
     */
    get data() {
      return state.data;
    },
    set data(v: unknown) {
      state.data =
        v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    },
    execution: {
      setNextRequest: (name: unknown) => {
        state.nextRequest = name == null ? null : String(name);
        emitExecutionEvent({
          type: 'flow',
          action: 'set-next-request',
          nextRequest: state.nextRequest
        });
      },
      skipRequest: () => {
        state.skipRequest = true;
        emitExecutionEvent({
          type: 'flow',
          action: 'skip-request'
        });
      }
    },
    test: (name: unknown, fn: () => void) => {
      const startedAt = performance.now();
      try {
        fn();
        state.tests.push({
          name: String(name),
          passed: true,
          durationMs: Math.round(performance.now() - startedAt)
        });
      } catch (err) {
        const durationMs = Math.round(performance.now() - startedAt);
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as Error).message)
            : String(err);
        const result: ScriptTestResult = {
          name: String(name),
          passed: false,
          error: message,
          durationMs
        };

        if (err && typeof err === 'object') {
          if ('expected' in err) {
            result.expected = String((err as { expected: unknown }).expected);
          }
          if ('actual' in err) {
            result.actual = String((err as { actual: unknown }).actual);
          }
          const stack =
            'stack' in err && typeof (err as { stack: unknown }).stack === 'string'
              ? (err as { stack: string }).stack
              : undefined;
          const location = resolveStackToOriginalLocation(stack, options?.compileMaps ?? []);
          if (location) {
            result.source = location.source;
            result.line = location.line;
            result.column = location.column;
          }
        }

        state.tests.push(result);
      }
    },
    /** Chai BDD expect; see https://www.chaijs.com/api/bdd/ */
    expect: scriptExpect
  };

  if (options?.sendRequest) {
    const transport = options.sendRequest;
    hc.sendRequest = async (req: unknown) => {
      const normalized = normalizeScriptSendRequest(req);
      const result = await transport(normalized);
      return {
        code: result.status,
        status: result.statusText,
        headers: result.headers,
        responseTime: result.timeMs,
        text: () => result.body,
        json: () => JSON.parse(result.body)
      };
    };
  } else {
    hc.sendRequest = () => {
      throw new Error('hc.sendRequest is not available in this script context');
    };
  }

  if (options?.ask) {
    const transport = options.ask;
    /**
     * Sends a one-shot prompt to a configured AI model.
     *
     * @param prompt - Text sent to the model.
     * @param askOptions - Optional `{ model }` where model is `"name"` or `"name: source"`.
     * @returns Model text, or null when AI is not configured / selection cannot be resolved.
     */
    hc.ask = async (prompt: unknown, askOptions?: unknown): Promise<string | null> => {
      const normalized = normalizeScriptAskRequest(prompt, askOptions);
      return transport(normalized);
    };
  } else {
    /**
     * Resolves to null when no ask transport is available in this script context.
     *
     * @returns Always null.
     */
    hc.ask = async (): Promise<string | null> => null;
  }

  const fileBridge = options?.fileBridge;
  /**
   * Invokes the main-process file bridge or throws when unavailable.
   *
   * @param req - Bridged operation payload.
   * @returns Operation result from main.
   */
  const callFileBridge = async (req: ScriptFileRequest): Promise<unknown> => {
    if (!fileBridge) {
      throw new Error('hc.fs is not available in this script context');
    }
    return fileBridge(req);
  };

  hc.fs = {
    readText: (path: unknown) => callFileBridge({ op: 'readText', path: String(path) }),
    readBytes: (path: unknown) => callFileBridge({ op: 'readBytes', path: String(path) }),
    writeText: (path: unknown, contents: unknown) =>
      callFileBridge({ op: 'writeText', path: String(path), contents: String(contents ?? '') }),
    writeBytes: (path: unknown, bytes: unknown) =>
      callFileBridge({
        op: 'writeBytes',
        path: String(path),
        bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayLike<number>)
      }),
    append: (path: unknown, contents: unknown) =>
      callFileBridge({ op: 'append', path: String(path), contents: String(contents ?? '') }),
    exists: (path: unknown) => callFileBridge({ op: 'exists', path: String(path) }),
    stat: (path: unknown) => callFileBridge({ op: 'stat', path: String(path) }),
    readJson: (path: unknown) => callFileBridge({ op: 'readJson', path: String(path) }),
    readYaml: (path: unknown) => callFileBridge({ op: 'readYaml', path: String(path) }),
    readCsv: (path: unknown, csvOptions?: ScriptCsvOptions) =>
      callFileBridge({ op: 'readCsv', path: String(path), options: csvOptions }),
    writeJson: (path: unknown, value: unknown, jsonOptions?: ScriptJsonWriteOptions) =>
      callFileBridge({
        op: 'writeJson',
        path: String(path),
        value,
        options: jsonOptions
      }),
    writeYaml: (path: unknown, value: unknown) =>
      callFileBridge({ op: 'writeYaml', path: String(path), value }),
    writeCsv: (path: unknown, rows: unknown, csvOptions?: ScriptCsvOptions) =>
      callFileBridge({
        op: 'writeCsv',
        path: String(path),
        value: rows,
        options: csvOptions
      })
  };

  hc.parse = {
    yaml: (text: unknown) => callFileBridge({ op: 'parseYaml', contents: String(text ?? '') }),
    csv: (text: unknown, csvOptions?: ScriptCsvOptions) =>
      callFileBridge({
        op: 'parseCsv',
        contents: String(text ?? ''),
        options: csvOptions
      })
  };

  hc.stringify = {
    yaml: (value: unknown) => callFileBridge({ op: 'stringifyYaml', value }),
    csv: (rows: unknown, csvOptions?: ScriptCsvOptions) =>
      callFileBridge({ op: 'stringifyCsv', value: rows, options: csvOptions })
  };

  if (ctx.response) {
    const resp: SendResult = ctx.response;
    let cachedDocument: ScriptDocumentFacade | undefined;
    const responseSubject = createResponseAssertionSubject(resp);
    hc.response = {
      get code() {
        return resp.status;
      },
      get status() {
        return resp.statusText;
      },
      get headers() {
        return resp.headers;
      },
      get responseTime() {
        return resp.timeMs;
      },
      get to() {
        return scriptExpect(responseSubject).to;
      },
      text: () => resp.body,
      json: () => JSON.parse(resp.body),
      document: () => {
        cachedDocument ??= parseResponseDocument(resp.body);
        return cachedDocument;
      }
    };
  }

  const scriptConsole = {
    log: (...args: unknown[]) => {
      state.logs.push(formatConsoleArgs(args));
    },
    error: (...args: unknown[]) => {
      state.logs.push(`[error] ${formatConsoleArgs(args)}`);
    }
  };

  return {
    hc,
    console: scriptConsole,
    readResult: () => ({
      request: state.request,
      variableSets: state.variableSets ?? {},
      variableClears: [...state.variableClears],
      collectionVariableSets: state.collectionVariableSets ?? {},
      collectionVariableClears: [...state.collectionVariableClears],
      folderVariableSets: state.folderVariableSets ?? {},
      folderVariableClears: [...state.folderVariableClears],
      environmentVariableSets: state.environmentVariableSets ?? {},
      environmentVariableClears: [...state.environmentVariableClears],
      globalVariableSets: state.globalVariableSets ?? {},
      globalVariableClears: [...state.globalVariableClears],
      cookieSets: state.cookieSets ?? {},
      cookieClears: [...state.cookieClears],
      collectionHeaders: state.collectionHeaders ?? [],
      collectionAuth: state.collectionAuth,
      folderHeaders: state.folderHeaders ?? [],
      folderAuth: state.folderAuth,
      nextRequest: state.nextRequest,
      skipRequest: state.skipRequest || undefined,
      tests: state.tests ?? [],
      logs: state.logs ?? [],
      executionEvents: state.executionEvents ?? [],
      data: state.data
    })
  };
}

/**
 * Default request/collection/environment context for plugin script sandboxes.
 *
 * @returns Minimal pre-phase context with an empty GET request and no variables.
 */
export function defaultScriptContextInput(): ScriptRunContextInput {
  return {
    phase: 'pre',
    request: {
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none',
      auth: defaultAuth(),
      tags: '',
      comment: ''
    },
    variables: {},
    data: {},
    info: buildScriptRunInfo('pre')
  };
}
