import {
  createScriptConsole,
  type ScriptConsole
} from '@harborclient/core/scripting/scriptConsoleRegistry';
import type {
  BodyType,
  KeyValue,
  ScriptExecutionEvent,
  ScriptExecutionVariableScope,
  ScriptLogLine,
  ScriptPhase,
  ScriptRequestContext,
  ScriptResponseOverride,
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
import { buildScriptResponseOverride } from '@harborclient/core/scripting/scriptResponseOverride';
import { parseResponseDocument, type ScriptDocumentFacade } from './scriptResponseDocument';
import { scriptExpect } from './scriptExpect';
import { createResponseAssertionSubject } from './scriptResponseAssertions';
import type {
  ScriptCsvOptions,
  ScriptFileRequest,
  ScriptJsonWriteOptions
} from './scriptFileOperations';
import { resolveStackToOriginalLocation, type ScriptCompileMap } from './scriptSourceMap';
import { variableKeyIsCleared } from '@harborclient/core/scripting/variableClearMatch';

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
 * Bridge operation for {@link ScriptApiOptions.webpage} / `hc.webpage`.
 */
export type ScriptWebpageRequest =
  | {
      op: 'open';
      /**
       * URL to find or open. When omitted, binds the active browser tab.
       */
      url?: string;
      /**
       * When true (default), reuse an open tab at the same URL.
       */
      reuse?: boolean;
    }
  | { op: 'focus'; tabId: string }
  | { op: 'close'; tabId: string }
  | {
      op: 'query';
      tabId: string;
      selector: string;
      all?: boolean;
      maxElements?: number;
    }
  | { op: 'evaluate'; tabId: string; expression: string }
  | { op: 'injectScript'; tabId: string; source: string }
  | { op: 'injectStylesheet'; tabId: string; css: string }
  | { op: 'screenshot'; tabId: string; fullPage?: boolean };

/**
 * Optional second argument to `hc.webpage(url, options)`.
 */
export interface ScriptWebpageOpenOptions {
  /**
   * When true (default), reuse an open browser tab whose URL matches.
   * When false, always open a new tab.
   */
  reuse?: boolean;
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
   * When provided, enables hc.webpage for opening and controlling embedded browser tabs.
   * When omitted, hc.webpage throws.
   */
  webpage?: (req: ScriptWebpageRequest) => Promise<unknown>;

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
  logs: ScriptLogLine[];
  executionEvents: ScriptExecutionEvent[];
  phase: ScriptPhase;
  nextRequest: string | null | undefined;
  skipRequest: boolean;
  responseOverride: ScriptResponseOverride | undefined;
  workflowNextAction: string | undefined;
  workflowSkipAction: boolean;
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
   *
   * Implements the common Console API methods used in request scripts
   * (see https://developer.mozilla.org/en-US/docs/Web/API/console).
   */
  console: ScriptConsole;

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
 * Clear accepts an exact key or a `namespace.*` pattern that removes every key
 * under that prefix for the remainder of the script run (and for persistence on
 * non-request scopes).
 *
 * @param scope - Variable scope label recorded in execution events.
 * @param getSets - Returns the mutable set map for this scope.
 * @param getClears - Returns the mutable clear set for this scope (exact keys or `namespace.*`).
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
      if (variableKeyIsCleared(k, getClears())) {
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
      } else if (variableKeyIsCleared(k, clears)) {
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
      const sets = getSets();
      for (const setKey of Object.keys(sets)) {
        if (variableKeyIsCleared(setKey, [k])) {
          delete sets[setKey];
        }
      }
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

function normalizeScriptWebpageOpenOptions(options?: unknown): ScriptWebpageOpenOptions {
  if (options == null) {
    return {};
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.webpage options must be an object');
  }
  const raw = options as Record<string, unknown>;
  if (!('reuse' in raw) || raw.reuse === undefined) {
    return {};
  }
  if (typeof raw.reuse !== 'boolean') {
    throw new Error('hc.webpage options.reuse must be a boolean');
  }
  return { reuse: raw.reuse };
}

/**
 * Throws when a webpage bridge result is an `{ error }` object.
 *
 * @param result - Raw bridge result.
 * @returns The result when it is not an error.
 * @throws When the bridge returned `{ error: string }`.
 */
function unwrapWebpageBridgeResult(result: unknown): unknown {
  if (
    result != null &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    Object.keys(result).length === 1 &&
    'error' in result &&
    typeof (result as { error: unknown }).error === 'string'
  ) {
    throw new Error((result as { error: string }).error);
  }
  return result;
}

/**
 * Normalizes optional `hc.webpage().screenshot` options.
 *
 * @param options - User-provided options (`fullPage` optional).
 * @returns Normalized `{ fullPage }` (default false).
 * @throws When options is present but not a plain object, or `fullPage` is not a boolean.
 */
function normalizeScriptWebpageScreenshotOptions(options?: unknown): { fullPage: boolean } {
  if (options == null) {
    return { fullPage: false };
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('hc.webpage().screenshot options must be an object');
  }
  const raw = options as Record<string, unknown>;
  if (!('fullPage' in raw) || raw.fullPage === undefined) {
    return { fullPage: false };
  }
  if (typeof raw.fullPage !== 'boolean') {
    throw new Error('hc.webpage().screenshot options.fullPage must be a boolean');
  }
  return { fullPage: raw.fullPage };
}

/**
 * Decodes a base64 PNG payload into bytes for `hc.fs.writeBytes`.
 *
 * @param pngBase64 - Base64-encoded PNG without a data-URL prefix.
 * @returns Raw PNG bytes.
 */
function decodePngBase64ToUint8Array(pngBase64: string): Uint8Array {
  return new Uint8Array(Buffer.from(pngBase64, 'base64'));
}

/**
 * Builds a webpage handle whose methods call the host webpage bridge.
 *
 * @param tab - Opened tab metadata from the bridge.
 * @param callWebpage - Bridge transport.
 * @param writeScreenshotBytes - Optional writer that saves PNG bytes under the script file root.
 * @returns Plain-object handle for the script sandbox.
 */
function createWebpageHandle(
  tab: {
    tabId: string;
    url: string;
    title: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
  },
  callWebpage: (req: ScriptWebpageRequest) => Promise<unknown>,
  writeScreenshotBytes?: (path: string, bytes: Uint8Array) => Promise<string>
): Record<string, unknown> {
  const tabId = tab.tabId;
  return {
    tabId,
    url: tab.url,
    title: tab.title,
    canGoBack: tab.canGoBack === true,
    canGoForward: tab.canGoForward === true,
    /**
     * Focuses this browser tab in the HarborClient tab bar.
     *
     * @returns Resolves when the tab is focused.
     */
    focus: async (): Promise<void> => {
      unwrapWebpageBridgeResult(await callWebpage({ op: 'focus', tabId }));
    },
    /**
     * Closes this browser tab, honoring page leave prompts.
     *
     * @returns True when closed; false when the user chose to stay.
     */
    close: async (): Promise<boolean> => {
      const result = unwrapWebpageBridgeResult(await callWebpage({ op: 'close', tabId })) as {
        closed: boolean;
      };
      return result.closed === true;
    },
    /**
     * Captures the visible viewport (or full page) as PNG and writes it under the script file root.
     *
     * @param path - Relative or absolute path under the script file access root.
     * @param screenshotOptions - Optional `{ fullPage }` (default false).
     * @returns Absolute path of the written file.
     */
    screenshot: async (path: unknown, screenshotOptions?: unknown): Promise<{ path: string }> => {
      const { fullPage } = normalizeScriptWebpageScreenshotOptions(screenshotOptions);
      const pathText = String(path ?? '').trim();
      if (!pathText) {
        throw new Error('hc.webpage().screenshot requires a path');
      }
      if (!writeScreenshotBytes) {
        throw new Error('hc.webpage().screenshot requires hc.fs');
      }
      const capture = unwrapWebpageBridgeResult(
        await callWebpage({ op: 'screenshot', tabId, fullPage })
      ) as {
        pngBase64?: string;
      };
      if (!capture || typeof capture.pngBase64 !== 'string' || !capture.pngBase64) {
        throw new Error('hc.webpage().screenshot did not return image data');
      }
      const absolutePath = await writeScreenshotBytes(
        pathText,
        decodePngBase64ToUint8Array(capture.pngBase64)
      );
      return { path: absolutePath };
    },
    dom: {
      /**
       * Queries the live page DOM with a CSS selector.
       *
       * @param selector - CSS selector.
       * @param queryOptions - Optional `{ all, maxElements }`.
       * @returns Match count and element summaries.
       */
      query: async (
        selector: unknown,
        queryOptions?: unknown
      ): Promise<{ selector: string; matchCount: number; elements: unknown[] }> => {
        const selectorText = String(selector ?? '').trim();
        if (!selectorText) {
          throw new Error('hc.webpage().dom.query requires a selector');
        }
        let all: boolean | undefined;
        let maxElements: number | undefined;
        if (queryOptions != null) {
          if (typeof queryOptions !== 'object' || Array.isArray(queryOptions)) {
            throw new Error('hc.webpage().dom.query options must be an object');
          }
          const raw = queryOptions as Record<string, unknown>;
          if ('all' in raw && raw.all !== undefined) {
            if (typeof raw.all !== 'boolean') {
              throw new Error('hc.webpage().dom.query options.all must be a boolean');
            }
            all = raw.all;
          }
          if ('maxElements' in raw && raw.maxElements !== undefined) {
            if (typeof raw.maxElements !== 'number' || !Number.isFinite(raw.maxElements)) {
              throw new Error('hc.webpage().dom.query options.maxElements must be a finite number');
            }
            maxElements = raw.maxElements;
          }
        }
        return unwrapWebpageBridgeResult(
          await callWebpage({ op: 'query', tabId, selector: selectorText, all, maxElements })
        ) as { selector: string; matchCount: number; elements: unknown[] };
      },
      /**
       * Evaluates JavaScript in the page main world and returns the result.
       *
       * @param expression - JavaScript source that returns a JSON-serializable value.
       * @returns Evaluation result.
       */
      evaluate: async (expression: unknown): Promise<unknown> => {
        const expressionText = String(expression ?? '').trim();
        if (!expressionText) {
          throw new Error('hc.webpage().dom.evaluate requires an expression');
        }
        const result = unwrapWebpageBridgeResult(
          await callWebpage({ op: 'evaluate', tabId, expression: expressionText })
        ) as { value: unknown };
        return result.value;
      },
      /**
       * Injects and runs JavaScript source in the page main world.
       *
       * @param source - JavaScript source to inject.
       * @returns Evaluation result from the injected script.
       */
      injectScript: async (source: unknown): Promise<unknown> => {
        const sourceText = String(source ?? '');
        if (!sourceText.trim()) {
          throw new Error('hc.webpage().dom.injectScript requires source');
        }
        const result = unwrapWebpageBridgeResult(
          await callWebpage({ op: 'injectScript', tabId, source: sourceText })
        ) as { value: unknown };
        return result.value;
      },
      /**
       * Injects a CSS stylesheet into the page.
       *
       * @param css - Stylesheet source.
       * @returns Electron insertion key.
       */
      injectStylesheet: async (css: unknown): Promise<string> => {
        const cssText = String(css ?? '');
        if (!cssText.trim()) {
          throw new Error('hc.webpage().dom.injectStylesheet requires css');
        }
        const result = unwrapWebpageBridgeResult(
          await callWebpage({ op: 'injectStylesheet', tabId, css: cssText })
        ) as { key: string };
        return result.key;
      }
    }
  };
}

/**
 * Normalizes a script sendRequest input from the hc API into a SendRequestInput.
 *
 * @param req - User-provided request object from hc.sendRequest.
 * @returns Normalized send input for the HTTP layer.
 */
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
    responseOverride: undefined,
    workflowNextAction: undefined,
    workflowSkipAction: false,
    data: input.data ? { ...input.data } : {}
  };

  const resolveRuntimeVariable = (key: string): string | undefined => {
    if (Object.prototype.hasOwnProperty.call(state.variableSets, key)) {
      return state.variableSets[key];
    }
    if (variableKeyIsCleared(key, state.variableClears)) {
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
      },
      get workflowId() {
        return info.workflowId;
      },
      get workflowActionId() {
        return info.workflowActionId;
      },
      get workflowActionIteration() {
        return info.workflowActionIteration;
      },
      get livepageId() {
        return info.livepageId;
      },
      get liveserverId() {
        return info.liveserverId;
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
            if (variableKeyIsCleared(key, state.variableClears)) {
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
      },
      /**
       * Jumps to a workflow action by UUID after the current action finishes.
       * No-op when the script is not running inside a workflow.
       *
       * @param actionId - Target workflow action UUID.
       */
      workflowNextAction: (actionId: unknown) => {
        if (!info.workflowId) {
          return;
        }
        state.workflowNextAction = String(actionId);
        emitExecutionEvent({
          type: 'flow',
          action: 'workflow-next-action',
          workflowNextAction: state.workflowNextAction
        });
      },
      /**
       * Skips the remainder of the current workflow action and advances to the next.
       * No-op when the script is not running inside a workflow.
       */
      workflowSkipAction: () => {
        if (!info.workflowId) {
          return;
        }
        state.workflowSkipAction = true;
        emitExecutionEvent({
          type: 'flow',
          action: 'workflow-skip-action'
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

  /**
   * Resolves after the given delay. Use for pacing between script steps.
   *
   * @param milliseconds - Non-negative finite delay in milliseconds.
   * @returns Promise that resolves when the delay elapses.
   * @throws When `milliseconds` is not a non-negative finite number.
   */
  hc.sleep = (milliseconds: unknown): Promise<void> => {
    const ms = Number(milliseconds);
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error('hc.sleep requires a non-negative finite number of milliseconds');
    }
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };

  /**
   * Records a synthetic response that replaces the real HTTP response for this send.
   *
   * Does not skip the HTTP call by itself — pair with hc.execution.skipRequest() in a
   * pre-request script when the remote request should not run. Last call wins within the phase.
   *
   * @param text - Response body text.
   * @param statusCode - Optional HTTP status (default 200).
   * @param contentType - Optional Content-Type (default text/plain; charset=utf-8).
   * @returns Resolves when the override is recorded.
   * @throws When statusCode is not an integer between 100 and 599.
   */
  hc.send = async (text: unknown, statusCode?: unknown, contentType?: unknown): Promise<void> => {
    const override = buildScriptResponseOverride(String(text ?? ''), statusCode, contentType);
    state.responseOverride = override;
    emitExecutionEvent({
      type: 'flow',
      action: 'send-response',
      status: override.status
    });
  };

  /**
   * Records a JSON synthetic response that replaces the real HTTP response for this send.
   *
   * Serializes value with JSON.stringify and sets Content-Type to application/json.
   * Does not skip the HTTP call by itself — pair with hc.execution.skipRequest() in a
   * pre-request script when the remote request should not run. Last call wins within the phase.
   *
   * @param value - Value to JSON-serialize as the response body.
   * @param statusCode - Optional HTTP status (default 200).
   * @returns Resolves when the override is recorded.
   * @throws When statusCode is not an integer between 100 and 599, or value is not JSON-serializable.
   */
  hc.sendJSON = async (value: unknown, statusCode?: unknown): Promise<void> => {
    const override = buildScriptResponseOverride(
      JSON.stringify(value),
      statusCode,
      'application/json'
    );
    state.responseOverride = override;
    emitExecutionEvent({
      type: 'flow',
      action: 'send-response',
      status: override.status
    });
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

  if (options?.webpage) {
    const transport = options.webpage;
    /**
     * Invokes the host webpage bridge or throws when the result is an error object.
     *
     * @param req - Webpage operation payload.
     * @returns Operation result from the host.
     */
    const callWebpage = async (req: ScriptWebpageRequest): Promise<unknown> => transport(req);

    /**
     * Opens or reuses an embedded browser tab and returns a control handle.
     *
     * Requires Settings → General → Allow script webpage access. Page load waits
     * count against the script timeout.
     *
     * @param url - Optional URL to open or reuse; omit to bind the active browser tab.
     * @param openOptions - Optional `{ reuse }` (default true).
     * @returns Handle with focus/close and `dom` helpers.
     */
    hc.webpage = async (url?: unknown, openOptions?: unknown): Promise<Record<string, unknown>> => {
      const normalizedOptions = normalizeScriptWebpageOpenOptions(openOptions);
      let openUrl: string | undefined;
      if (url !== undefined && url !== null) {
        const trimmed = String(url).trim();
        if (!trimmed) {
          throw new Error('hc.webpage requires a non-empty url when provided');
        }
        openUrl = trimmed;
      }
      const opened = unwrapWebpageBridgeResult(
        await callWebpage({
          op: 'open',
          url: openUrl,
          reuse: normalizedOptions.reuse
        })
      ) as {
        tabId: string;
        url: string;
        title: string;
        canGoBack?: boolean;
        canGoForward?: boolean;
      };
      if (!opened || typeof opened.tabId !== 'string') {
        throw new Error('hc.webpage open did not return a tab');
      }
      /**
       * Writes screenshot PNG bytes via the script file bridge and returns the absolute path.
       *
       * @param path - Relative or absolute path under the script file root.
       * @param bytes - PNG bytes to write.
       * @returns Absolute written path.
       */
      const writeScreenshotBytes = async (path: string, bytes: Uint8Array): Promise<string> => {
        if (!options.fileBridge) {
          throw new Error('hc.webpage().screenshot requires hc.fs');
        }
        const result = await options.fileBridge({ op: 'writeBytes', path, bytes });
        if (typeof result !== 'string' || !result.trim()) {
          throw new Error('hc.webpage().screenshot failed to resolve write path');
        }
        return result;
      };
      return createWebpageHandle(
        opened,
        callWebpage,
        options.fileBridge ? writeScreenshotBytes : undefined
      );
    };
  } else {
    /**
     * Throws when no webpage transport is available in this script context.
     *
     * @throws Always — webpage control requires the GUI script bridge.
     */
    hc.webpage = async (): Promise<never> => {
      throw new Error('hc.webpage is not available in this script context');
    };
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

  const scriptConsole = createScriptConsole(state);

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
      responseOverride: state.responseOverride,
      workflowNextAction: state.workflowNextAction,
      workflowSkipAction: state.workflowSkipAction || undefined,
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
