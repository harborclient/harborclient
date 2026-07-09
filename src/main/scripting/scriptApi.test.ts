import { describe, expect, it } from 'vitest';
import { createScriptApi } from '#/main/scripting/scriptApi';
import { defaultAuth } from '#/shared/auth';
import type { SendResult } from '#/shared/types';

const baseInput = {
  phase: 'pre' as const,
  request: {
    method: 'GET' as const,
    url: 'https://example.com/path',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none' as const
  },
  variables: { token: 'runtime', host: 'example.com' }
};

describe('createScriptApi hc.info', () => {
  it('exposes Postman-compatible metadata from input.info', () => {
    const api = createScriptApi({
      ...baseInput,
      phase: 'post',
      info: {
        eventName: 'test',
        requestName: 'Login',
        requestId: '42',
        iteration: 0
      }
    });
    const info = api.hc.info as {
      eventName: string;
      requestName: string;
      requestId: string;
      iteration: number;
    };

    expect(info.eventName).toBe('test');
    expect(info.requestName).toBe('Login');
    expect(info.requestId).toBe('42');
    expect(info.iteration).toBe(0);
  });

  it('defaults info from phase when input.info is omitted', () => {
    const api = createScriptApi(baseInput);
    const info = api.hc.info as {
      eventName: string;
      requestName: string;
      requestId: string;
      iteration: number;
    };

    expect(info.eventName).toBe('prerequest');
    expect(info.requestName).toBe('');
    expect(info.requestId).toBe('');
    expect(info.iteration).toBe(0);
  });
});

describe('createScriptApi variable bag clear', () => {
  it('clears runtime variables without persisting to collection scope', () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      request: {
        variables: { get: (k: string) => string | undefined; clear: (k: string) => void };
      };
      collection: { variables: { get: (k: string) => string | undefined } };
    };

    hc.request.variables.clear('token');
    expect(hc.request.variables.get('token')).toBeUndefined();
    expect(hc.collection.variables.get('token')).toBe('runtime');

    const result = api.readResult();
    expect(result.variableClears).toEqual(['token']);
    expect(result.collectionVariableClears).toEqual([]);
  });

  it('clears collection, environment, and global keys independently', () => {
    const api = createScriptApi({
      ...baseInput,
      environment: { name: 'Production' }
    });
    const hc = api.hc as {
      collection: {
        variables: { set: (k: string, v: string) => void; clear: (k: string) => void };
      };
      environment: {
        variables: { set: (k: string, v: string) => void; clear: (k: string) => void };
      };
      globals: { set: (k: string, v: string) => void; clear: (k: string) => void };
    };

    hc.collection.variables.set('token', 'collection');
    hc.environment.variables.set('token', 'environment');
    hc.globals.set('token', 'global');
    hc.collection.variables.clear('token');
    hc.environment.variables.clear('token');
    hc.globals.clear('token');

    const result = api.readResult();
    expect(result.collectionVariableClears).toEqual(['token']);
    expect(result.environmentVariableClears).toEqual(['token']);
    expect(result.globalVariableClears).toEqual(['token']);
  });

  it('set after clear restores the key in that scope', () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      request: {
        variables: {
          set: (k: string, v: string) => void;
          clear: (k: string) => void;
          get: (k: string) => string | undefined;
        };
      };
    };

    hc.request.variables.clear('token');
    hc.request.variables.set('token', 'restored');
    expect(hc.request.variables.get('token')).toBe('restored');

    const result = api.readResult();
    expect(result.variableClears).toEqual([]);
    expect(result.variableSets).toEqual({ token: 'restored' });
  });
});

describe('createScriptApi cookies bag', () => {
  it('reads, sets, and clears cookies for the seeded host rows', () => {
    const api = createScriptApi({
      ...baseInput,
      cookies: [{ key: 'session', value: 'abc', enabled: true }]
    });
    const hc = api.hc as {
      cookies: {
        get: (name: string) => string | undefined;
        set: (name: string, value: string) => void;
        clear: (name: string) => void;
      };
    };

    expect(hc.cookies.get('session')).toBe('abc');
    hc.cookies.set('session', 'updated');
    hc.cookies.set('theme', 'dark');
    hc.cookies.clear('theme');

    const result = api.readResult();
    expect(result.cookieSets).toEqual({ session: 'updated' });
    expect(result.cookieClears).toEqual(['theme']);
  });
});

describe('createScriptApi execution', () => {
  it('records setNextRequest and skipRequest directives', () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      execution: {
        setNextRequest: (name: string | null) => void;
        skipRequest: () => void;
      };
    };

    hc.execution.setNextRequest('Login');
    hc.execution.skipRequest();

    const result = api.readResult();
    expect(result.nextRequest).toBe('Login');
    expect(result.skipRequest).toBe(true);
    expect(result.executionEvents).toEqual([
      { type: 'flow', action: 'set-next-request', nextRequest: 'Login' },
      { type: 'flow', action: 'skip-request' }
    ]);
  });

  it('records stop-run flow when setNextRequest receives null', () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      execution: {
        setNextRequest: (name: string | null) => void;
      };
    };

    hc.execution.setNextRequest(null);

    const result = api.readResult();
    expect(result.executionEvents).toEqual([
      { type: 'flow', action: 'set-next-request', nextRequest: null }
    ]);
  });
});

describe('createScriptApi execution events', () => {
  it('records set, update, and clear variable activity in call order', () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      request: {
        variables: {
          set: (k: string, v: string) => void;
          clear: (k: string) => void;
        };
      };
      collection: {
        variables: {
          set: (k: string, v: string) => void;
        };
      };
      globals: {
        set: (k: string, v: string) => void;
      };
    };

    hc.request.variables.set('token', 'new');
    hc.collection.variables.set('token', 'collection');
    hc.globals.set('token', 'global');
    hc.request.variables.clear('token');

    const result = api.readResult();
    expect(result.executionEvents).toEqual([
      { type: 'variable', scope: 'request', action: 'update', key: 'token', value: 'new' },
      {
        type: 'variable',
        scope: 'collection',
        action: 'update',
        key: 'token',
        value: 'collection'
      },
      { type: 'variable', scope: 'global', action: 'update', key: 'token', value: 'global' },
      { type: 'variable', scope: 'request', action: 'clear', key: 'token' }
    ]);
  });

  it('records set instead of update when a key had no prior value in that scope', () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      environment: {
        variables: {
          set: (k: string, v: string) => void;
        };
      };
    };

    hc.environment.variables.set('apiKey', 'secret');

    const result = api.readResult();
    expect(result.executionEvents).toEqual([
      { type: 'variable', scope: 'environment', action: 'set', key: 'apiKey', value: 'secret' }
    ]);
  });
});

describe('createScriptApi auth bag', () => {
  it('exposes flat get/set/update for request and collection auth', () => {
    const api = createScriptApi({
      ...baseInput,
      request: {
        ...baseInput.request,
        auth: defaultAuth()
      },
      collection: {
        id: 1,
        name: 'Demo',
        headers: [],
        auth: {
          ...defaultAuth(),
          type: 'basic',
          basic: { username: 'bob', password: 'pw' }
        }
      }
    });
    const hc = api.hc as {
      request: {
        auth: {
          get: () => Record<string, unknown>;
          set: (input: Record<string, unknown>) => void;
          update: (field: string, value: unknown) => void;
        };
      };
      collection: {
        auth: {
          get: () => Record<string, unknown>;
          set: (input: Record<string, unknown>) => void;
          update: (field: string, value: unknown) => void;
        };
      };
    };

    expect(hc.collection.auth.get()).toEqual({
      type: 'basic',
      username: 'bob',
      password: 'pw'
    });

    hc.request.auth.set({ type: 'bearer', token: 'req-token' });
    hc.collection.auth.update('token', '{{idToken}}');
    hc.collection.auth.update('type', 'bearer');

    expect(hc.request.auth.get()).toEqual({ type: 'bearer', token: 'req-token' });

    const result = api.readResult();
    expect(result.request.auth?.bearer.token).toBe('req-token');
    expect(result.collectionAuth?.type).toBe('bearer');
    expect(result.collectionAuth?.bearer.token).toBe('{{idToken}}');
    expect(result.collectionAuth?.basic.username).toBe('bob');
  });
});

describe('createScriptApi sendRequest', () => {
  it('uses the injected transport when provided', async () => {
    const sendResult: SendResult = {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      timeMs: 10,
      sizeBytes: 11
    };

    const api = createScriptApi(baseInput, {
      sendRequest: async () => sendResult
    });
    const hc = api.hc as {
      sendRequest: (req: { url: string }) => Promise<{ code: number; json: () => unknown }>;
    };

    const response = await hc.sendRequest({ url: 'https://api.example.com' });
    expect(response.code).toBe(201);
    expect(response.json()).toEqual({ ok: true });
  });

  it('throws when no transport is available', () => {
    const api = createScriptApi(baseInput);
    const sendRequest = api.hc.sendRequest as (req: { url: string }) => Promise<unknown>;

    expect(() => sendRequest({ url: 'https://api.example.com' })).toThrow(
      'hc.sendRequest is not available in this script context'
    );
  });
});
