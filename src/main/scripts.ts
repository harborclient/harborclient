import vm from 'node:vm';
import type { ScriptRunInput, ScriptRunResult } from '#/shared/types';

const SCRIPT_TIMEOUT_MS = 5000;

const BOOTSTRAP = `
// hc API surface — keep autocomplete in hcCompletions.ts in sync with this bootstrap.
const ctx = JSON.parse(__CONTEXT__);
const state = {
  request: ctx.request,
  variables: Object.assign({}, ctx.variables),
  variableSets: {},
  tests: [],
  logs: [],
  phase: ctx.phase
};

function upsertHeader(key, value) {
  const k = String(key);
  const v = String(value);
  const rows = state.request.headers;
  const existing = rows.find(function(h) {
    return h.enabled && h.key.trim().toLowerCase() === k.toLowerCase();
  });
  if (existing) {
    existing.value = v;
  } else {
    rows.push({ key: k, value: v, enabled: true });
  }
}

function headerGet(key) {
  const k = String(key).toLowerCase();
  const row = state.request.headers.find(function(h) {
    return h.enabled && h.key.trim().toLowerCase() === k;
  });
  return row ? row.value : undefined;
}

function headerToMap() {
  const map = {};
  for (const h of state.request.headers) {
    if (h.enabled && h.key.trim()) {
      map[h.key.trim()] = h.value;
    }
  }
  return map;
}

function makeExpect(actual) {
  return {
    to: {
      equal: function(expected) {
        if (actual !== expected) {
          throw new Error(
            'Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual)
          );
        }
      },
      eql: function(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(
            'Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual)
          );
        }
      },
      include: function(substr) {
        if (typeof actual !== 'string' || actual.indexOf(substr) === -1) {
          throw new Error(
            'Expected ' + JSON.stringify(actual) + ' to include ' + JSON.stringify(substr)
          );
        }
      }
    },
    be: {
      ok: function() {
        if (!actual) {
          throw new Error('Expected truthy value but got ' + JSON.stringify(actual));
        }
      }
    }
  };
}

const hc = {
  request: {
    get method() { return state.request.method; },
    set method(v) { state.request.method = String(v); },
    get url() { return state.request.url; },
    set url(v) { state.request.url = String(v); },
    get body() { return state.request.body; },
    set body(v) { state.request.body = String(v); },
    headers: {
      get: headerGet,
      upsert: upsertHeader,
      toObject: headerToMap
    }
  },
  variables: {
    get: function(k) {
      if (Object.prototype.hasOwnProperty.call(state.variableSets, k)) {
        return state.variableSets[k];
      }
      return state.variables[k];
    },
    set: function(k, v) {
      state.variableSets[k] = String(v);
    }
  },
  test: function(name, fn) {
    try {
      fn();
      state.tests.push({ name: String(name), passed: true });
    } catch (err) {
      state.tests.push({
        name: String(name),
        passed: false,
        error: String(err && err.message ? err.message : err)
      });
    }
  },
  expect: function(actual) {
    return makeExpect(actual);
  }
};

if (ctx.response) {
  const resp = ctx.response;
  hc.response = {
    get code() { return resp.status; },
    get status() { return resp.statusText; },
    get headers() { return resp.headers; },
    get responseTime() { return resp.timeMs; },
    text: function() { return resp.body; },
    json: function() { return JSON.parse(resp.body); }
  };
}

const console = {
  log: function() {
    const args = Array.prototype.slice.call(arguments);
    state.logs.push(
      args.map(function(a) { return typeof a === 'string' ? a : JSON.stringify(a); }).join(' ')
    );
  },
  error: function() {
    const args = Array.prototype.slice.call(arguments);
    state.logs.push(
      '[error] ' +
        args.map(function(a) { return typeof a === 'string' ? a : JSON.stringify(a); }).join(' ')
    );
  }
};
`;

/**
 * Strips filesystem paths and vm framing from script errors before they reach the UI.
 *
 * User scripts and the vm runtime can embed absolute paths or `evalmachine` locations
 * that are useful for main-process debugging but should not appear in the renderer.
 *
 * @param message - Raw error message from the vm sandbox or Node vm runtime.
 * @returns Single-line message with absolute paths replaced by `[path]`.
 */
function sanitizeScriptErrorMessage(message: string): string {
  const firstLine = message.split('\n')[0]?.trim() ?? '';
  if (!firstLine) {
    return 'Script execution failed';
  }

  let sanitized = firstLine.replace(/evalmachine\.<anonymous>/g, 'script');

  sanitized = sanitized
    .replace(/[A-Za-z]:[\\/][^\s'"(),\]}]+/g, '[path]')
    .replace(/(^|[\s(,])(\/(?:[\w.-]+\/)+[\w.-]*)/g, '$1[path]');

  return sanitized;
}

/**
 * Runs a pre/post script inside a `node:vm` sandbox with the hc API.
 *
 * The context is created with a fresh global that exposes only the standard
 * JavaScript built-ins; Node globals such as `require` and `process` are
 * intentionally not passed through. `node:vm` is not a hard security boundary,
 * but these scripts are authored by the user themselves.
 *
 * @param input - Script source, phase, request/response context, and variables.
 * @returns Mutated request, variable sets, tests, and logs from the sandbox.
 */
export async function runScript(input: ScriptRunInput): Promise<ScriptRunResult> {
  const passthrough: ScriptRunResult = {
    request: input.request,
    variableSets: {},
    tests: [],
    logs: []
  };

  if (!input.script.trim()) {
    return passthrough;
  }

  const contextPayload = JSON.stringify({
    phase: input.phase,
    request: input.request,
    response: input.response,
    variables: input.variables
  });

  const sandbox = vm.createContext({ __CONTEXT__: contextPayload });

  try {
    const fullScript = `${BOOTSTRAP}\n${input.script}\nJSON.stringify(state);`;
    const script = new vm.Script(fullScript);
    const resultJson = script.runInContext(sandbox, { timeout: SCRIPT_TIMEOUT_MS });
    const state = JSON.parse(String(resultJson)) as {
      request: ScriptRunResult['request'];
      variableSets: Record<string, string>;
      tests: ScriptRunResult['tests'];
      logs: string[];
    };

    return {
      request: state.request,
      variableSets: state.variableSets ?? {},
      tests: state.tests ?? [],
      logs: state.logs ?? []
    };
  } catch (err) {
    // Errors thrown inside the vm context come from a different realm, so
    // `instanceof Error` is unreliable; read `message` defensively instead.
    const rawMessage =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return {
      ...passthrough,
      error: sanitizeScriptErrorMessage(rawMessage)
    };
  }
}
