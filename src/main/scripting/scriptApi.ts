import type {
  KeyValue,
  ScriptPhase,
  ScriptRequestContext,
  ScriptRunInput,
  ScriptRunResult,
  ScriptTestResult,
  SendResult
} from '#/shared/types';
import { resolveDynamicVariable, VARIABLE_TOKEN_PATTERN } from '@harborclient/sdk/variables';
import {
  parseResponseDocument,
  type ScriptDocumentFacade
} from '#/main/scripting/scriptResponseDocument';

/**
 * Context fields passed into the hc sandbox without user script source.
 */
export type ScriptRunContextInput = Omit<ScriptRunInput, 'script'>;

/**
 * Mutable sandbox state mutated by hc APIs during script execution.
 */
interface ScriptApiState {
  request: ScriptRequestContext;
  variables: Record<string, string>;
  variableSets: Record<string, string>;
  collectionVariableSets: Record<string, string>;
  environmentVariableSets: Record<string, string>;
  globalVariableSets: Record<string, string>;
  collectionHeaders: KeyValue[];
  tests: ScriptTestResult[];
  logs: string[];
  phase: ScriptPhase;
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
 * Builds a chai-lite expect matcher with the same messages as the legacy bootstrap.
 *
 * @param actual - Value under assertion.
 * @returns Matcher object with `to` and `be` chains.
 */
function makeExpect(actual: unknown): {
  to: {
    equal: (expected: unknown) => void;
    eql: (expected: unknown) => void;
    include: (substr: string) => void;
  };
  be: {
    ok: () => void;
  };
} {
  return {
    to: {
      equal: (expected: unknown) => {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      eql: (expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      include: (substr: string) => {
        if (typeof actual !== 'string' || actual.indexOf(substr) === -1) {
          throw new Error(
            `Expected ${JSON.stringify(actual)} to include ${JSON.stringify(substr)}`
          );
        }
      }
    },
    be: {
      ok: () => {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
        }
      }
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
 * Builds the hc API and capturing console over a fresh mutable state.
 *
 * Shared by pre/post request scripts and main-process plugin script contexts so
 * the hc surface never drifts between runners.
 *
 * @param input - Phase, request, response, variables, and optional collection/environment context.
 * @returns hc object, console, and a reader for accumulated sandbox mutations.
 */
export function createScriptApi(input: ScriptRunContextInput): ScriptApi {
  const ctx = {
    phase: input.phase,
    request: input.request,
    response: input.response,
    variables: input.variables,
    collection: input.collection,
    environment: input.environment
  };

  const state: ScriptApiState = {
    request: input.request,
    variables: { ...input.variables },
    variableSets: {},
    collectionVariableSets: {},
    environmentVariableSets: {},
    globalVariableSets: {},
    collectionHeaders: input.collection?.headers ? [...input.collection.headers] : [],
    tests: [],
    logs: [],
    phase: input.phase
  };

  const hc: Record<string, unknown> = {
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
      headers: makeHeaderApi(() => state.request.headers)
    },
    variables: {
      get: (k: string) => {
        if (Object.prototype.hasOwnProperty.call(state.variableSets, k)) {
          return state.variableSets[k];
        }
        return state.variables[k];
      },
      set: (k: string, v: unknown) => {
        state.variableSets[k] = String(v);
      },
      replaceIn: (template: unknown) => {
        const text = String(template);
        const pattern = new RegExp(VARIABLE_TOKEN_PATTERN.source, 'g');
        return text.replace(pattern, (match, key: string) => {
          if (Object.prototype.hasOwnProperty.call(state.variableSets, key)) {
            return state.variableSets[key];
          }
          if (Object.prototype.hasOwnProperty.call(state.variables, key)) {
            return state.variables[key];
          }
          const dynamic = resolveDynamicVariable(key);
          return dynamic !== undefined ? dynamic : match;
        });
      }
    },
    collection: {
      get id() {
        return ctx.collection ? ctx.collection.id : null;
      },
      get name() {
        return ctx.collection ? ctx.collection.name : '';
      },
      variables: {
        get: (k: string) => {
          if (Object.prototype.hasOwnProperty.call(state.collectionVariableSets, k)) {
            return state.collectionVariableSets[k];
          }
          return state.variables[k];
        },
        set: (k: string, v: unknown) => {
          state.collectionVariableSets[k] = String(v);
        }
      },
      headers: makeHeaderApi(() => state.collectionHeaders)
    },
    environment: {
      get name() {
        return ctx.environment ? ctx.environment.name : '';
      },
      variables: {
        get: (k: string) => {
          if (Object.prototype.hasOwnProperty.call(state.environmentVariableSets, k)) {
            return state.environmentVariableSets[k];
          }
          return state.variables[k];
        },
        set: (k: string, v: unknown) => {
          state.environmentVariableSets[k] = String(v);
        }
      }
    },
    globals: {
      get: (k: string) => {
        if (Object.prototype.hasOwnProperty.call(state.globalVariableSets, k)) {
          return state.globalVariableSets[k];
        }
        return state.variables[k];
      },
      set: (k: string, v: unknown) => {
        state.globalVariableSets[k] = String(v);
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
    expect: (actual: unknown) => makeExpect(actual)
  };

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
      collectionVariableSets: state.collectionVariableSets ?? {},
      environmentVariableSets: state.environmentVariableSets ?? {},
      globalVariableSets: state.globalVariableSets ?? {},
      collectionHeaders: state.collectionHeaders ?? [],
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
      bodyType: 'none'
    },
    variables: {}
  };
}
