import ivm from 'isolated-vm';
import type { ScriptRunInput, ScriptRunResult } from '#/shared/types';

const SCRIPT_TIMEOUT_MS = 5000;
const MEMORY_LIMIT_MB = 128;

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
 * Runs a pre/post script inside an isolated-vm sandbox with the hc API.
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

  const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
  try {
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set('global', jail.derefInto());

    const contextPayload = JSON.stringify({
      phase: input.phase,
      request: input.request,
      response: input.response,
      variables: input.variables
    });
    await jail.set('__CONTEXT__', contextPayload, { copy: true });

    const fullScript = `${BOOTSTRAP}\n${input.script}\nJSON.stringify(state);`;
    const compiled = await isolate.compileScript(fullScript);
    const resultJson = await compiled.run(context, { timeout: SCRIPT_TIMEOUT_MS });
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
    const message = err instanceof Error ? err.message : 'Unknown script error';
    return {
      ...passthrough,
      error: message
    };
  } finally {
    isolate.dispose();
  }
}
