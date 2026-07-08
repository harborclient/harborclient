import type {
  BodyType,
  KeyValue,
  ScriptPhase,
  ScriptRequestContext,
  ScriptRunInfo,
  ScriptRunInput,
  ScriptRunResult,
  ScriptTestResult,
  SendRequestInput,
  SendResult
} from '#/shared/types';
import { buildScriptRunInfo } from '#/shared/types/script';
import {
  applyScriptAuthSet,
  applyScriptAuthUpdate,
  defaultAuth,
  flattenAuthConfig,
  normalizeAuth,
  type AuthConfig
} from '#/shared/auth';
import { resolveDynamicVariable, VARIABLE_TOKEN_PATTERN } from '@harborclient/sdk/variables';
import {
  parseResponseDocument,
  type ScriptDocumentFacade
} from '#/main/scripting/scriptResponseDocument';
import { scriptExpect } from '#/main/scripting/scriptExpect';

/**
 * Context fields passed into the hc sandbox without user script source.
 */
export type ScriptRunContextInput = Omit<ScriptRunInput, 'script'>;

/**
 * Optional runtime hooks injected when building the hc API.
 */
export interface ScriptApiOptions {
  /**
   * When provided, enables hc.sendRequest for outbound HTTP from the script sandbox.
   */
  sendRequest?: (req: SendRequestInput) => Promise<SendResult>;
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
  environmentVariableSets: Record<string, string>;
  environmentVariableClears: Set<string>;
  globalVariableSets: Record<string, string>;
  globalVariableClears: Set<string>;
  cookies: KeyValue[];
  cookieSets: Record<string, string>;
  cookieClears: Set<string>;
  collectionHeaders: KeyValue[];
  collectionAuth: AuthConfig;
  tests: ScriptTestResult[];
  logs: string[];
  phase: ScriptPhase;
  nextRequest: string | null | undefined;
  skipRequest: boolean;
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
 * @param getSets - Returns the mutable set map for this scope.
 * @param getClears - Returns the mutable clear set for this scope.
 * @param getFallback - Resolves values from the merged runtime variable map.
 * @returns Variable bag API shared by request, collection, environment, and global scopes.
 */
function makeVariableBag(
  getSets: () => Record<string, string>,
  getClears: () => Set<string>,
  getFallback: (key: string) => string | undefined
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
      getClears().delete(k);
      getSets()[k] = String(value);
    },
    clear: (key: string) => {
      const k = String(key);
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
 * Builds a case-insensitive header accessor over mutable key/value rows.
 *
 * @param getRows - Returns the header rows mutated by upsert.
 * @returns Header get/upsert/toObject helpers shared by request and collection headers.
 */
function makeHeaderApi(getRows: () => KeyValue[]): {
  get: (key: string) => string | undefined;
  upsert: (key: string, value: string) => void;
  toObject: () => Record<string, string>;
} {
  return {
    get: (key: string) => {
      const k = String(key).toLowerCase();
      const row = getRows().find((h) => h.enabled && h.key.trim().toLowerCase() === k);
      return row ? row.value : undefined;
    },
    upsert: (key: string, value: string) => {
      const k = String(key);
      const v = String(value);
      const rows = getRows();
      const existing = rows.find(
        (h) => h.enabled && h.key.trim().toLowerCase() === k.toLowerCase()
      );
      if (existing) {
        existing.value = v;
      } else {
        rows.push({ key: k, value: v, enabled: true });
      }
    },
    toObject: () => {
      const map: Record<string, string> = {};
      for (const h of getRows()) {
        if (h.enabled && h.key.trim()) {
          map[h.key.trim()] = h.value;
        }
      }
      return map;
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
 * @param options - Optional runtime hooks such as hc.sendRequest transport.
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
    environment: input.environment
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
    environmentVariableSets: {},
    environmentVariableClears: new Set<string>(),
    globalVariableSets: {},
    globalVariableClears: new Set<string>(),
    cookies: input.cookies ? input.cookies.map((cookie) => ({ ...cookie })) : [],
    cookieSets: {},
    cookieClears: new Set<string>(),
    collectionHeaders: input.collection?.headers ? [...input.collection.headers] : [],
    collectionAuth: normalizeAuth(input.collection?.auth),
    tests: [],
    logs: [],
    phase: input.phase,
    nextRequest: undefined,
    skipRequest: false
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
      headers: makeHeaderApi(() => state.request.headers),
      auth: makeAuthApi(() => state.request.auth!),
      variables: {
        ...makeVariableBag(
          () => state.variableSets,
          () => state.variableClears,
          resolveRuntimeVariable
        ),
        replaceIn: (template: unknown) => {
          const text = String(template);
          const pattern = new RegExp(VARIABLE_TOKEN_PATTERN.source, 'g');
          return text.replace(pattern, (match, key: string) => {
            if (Object.prototype.hasOwnProperty.call(state.variableSets, key)) {
              return state.variableSets[key];
            }
            if (state.variableClears.has(key)) {
              return match;
            }
            if (Object.prototype.hasOwnProperty.call(state.variables, key)) {
              return state.variables[key];
            }
            const dynamic = resolveDynamicVariable(key);
            return dynamic !== undefined ? dynamic : match;
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
        () => state.collectionVariableSets,
        () => state.collectionVariableClears,
        resolveSeededVariable
      ),
      headers: makeHeaderApi(() => state.collectionHeaders),
      auth: makeAuthApi(() => state.collectionAuth)
    },
    environment: {
      get name() {
        return ctx.environment ? ctx.environment.name : '';
      },
      variables: makeVariableBag(
        () => state.environmentVariableSets,
        () => state.environmentVariableClears,
        resolveSeededVariable
      )
    },
    globals: makeVariableBag(
      () => state.globalVariableSets,
      () => state.globalVariableClears,
      resolveSeededVariable
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
    execution: {
      setNextRequest: (name: unknown) => {
        state.nextRequest = name == null ? null : String(name);
      },
      skipRequest: () => {
        state.skipRequest = true;
      }
    },
    test: (name: unknown, fn: () => void) => {
      try {
        fn();
        state.tests.push({ name: String(name), passed: true });
      } catch (err) {
        state.tests.push({
          name: String(name),
          passed: false,
          error: String(
            err && typeof err === 'object' && 'message' in err ? (err as Error).message : err
          )
        });
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

  if (ctx.response) {
    const resp: SendResult = ctx.response;
    let cachedDocument: ScriptDocumentFacade | undefined;
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
      environmentVariableSets: state.environmentVariableSets ?? {},
      environmentVariableClears: [...state.environmentVariableClears],
      globalVariableSets: state.globalVariableSets ?? {},
      globalVariableClears: [...state.globalVariableClears],
      cookieSets: state.cookieSets ?? {},
      cookieClears: [...state.cookieClears],
      collectionHeaders: state.collectionHeaders ?? [],
      collectionAuth: state.collectionAuth,
      nextRequest: state.nextRequest,
      skipRequest: state.skipRequest || undefined,
      tests: state.tests ?? [],
      logs: state.logs ?? []
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
      auth: defaultAuth()
    },
    variables: {},
    info: buildScriptRunInfo('pre')
  };
}
