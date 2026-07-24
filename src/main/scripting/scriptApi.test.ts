import { describe, expect, it } from 'vitest';
import { createScriptApi } from './scriptApi';
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

describe('createScriptApi parameter bags', () => {
  it('exposes get/set/clear for request params', () => {
    const api = createScriptApi({
      ...baseInput,
      request: {
        ...baseInput.request,
        params: [{ key: 'q', value: 'search', enabled: true }]
      }
    });
    const hc = api.hc as {
      request: {
        params: {
          get: {
            (): Record<string, string>;
            (key: string): string | undefined;
          };
          set: {
            (entries: Record<string, unknown>): void;
            (key: string, value: unknown): void;
          };
          clear: () => void;
        };
      };
    };

    expect(hc.request.params.get('q')).toBe('search');
    hc.request.params.set({ foo: 'bar', bar: 'foo' });
    hc.request.params.set('extra', 'value');

    expect(hc.request.params.get()).toEqual({
      q: 'search',
      foo: 'bar',
      bar: 'foo',
      extra: 'value'
    });

    hc.request.params.clear();
    expect(hc.request.params.get()).toEqual({});

    const result = api.readResult();
    expect(result.request.params).toEqual([]);
  });

  it('exposes case-insensitive get/set/clear for request headers', () => {
    const api = createScriptApi({
      ...baseInput,
      request: {
        ...baseInput.request,
        headers: [{ key: 'X-Test', value: '1', enabled: true }]
      }
    });
    const hc = api.hc as {
      request: {
        headers: {
          get: {
            (): Record<string, string>;
            (key: string): string | undefined;
          };
          set: {
            (entries: Record<string, unknown>): void;
            (key: string, value: unknown): void;
          };
          clear: () => void;
        };
      };
    };

    hc.request.headers.set('authorization', 'Bearer token');
    expect(hc.request.headers.get('Authorization')).toBe('Bearer token');
    expect(hc.request.headers.get()).toEqual({
      'X-Test': '1',
      'authorization': 'Bearer token'
    });

    hc.request.headers.clear();
    expect(hc.request.headers.get()).toEqual({});
  });

  it('exposes get/set/clear for collection headers', () => {
    const api = createScriptApi({
      ...baseInput,
      collection: {
        id: 1,
        name: 'Demo',
        headers: [{ key: 'X-Api-Key', value: 'secret', enabled: true }]
      }
    });
    const hc = api.hc as {
      collection: {
        headers: {
          get: {
            (): Record<string, string>;
            (key: string): string | undefined;
          };
          set: {
            (entries: Record<string, unknown>): void;
            (key: string, value: unknown): void;
          };
          clear: () => void;
        };
      };
    };

    hc.collection.headers.set('Authorization', 'Bearer token');
    expect(hc.collection.headers.get()).toEqual({
      'X-Api-Key': 'secret',
      'Authorization': 'Bearer token'
    });

    const result = api.readResult();
    expect(result.collectionHeaders).toEqual([
      { key: 'X-Api-Key', value: 'secret', enabled: true },
      { key: 'Authorization', value: 'Bearer token', enabled: true }
    ]);
  });
});

describe('createScriptApi notes bag', () => {
  it('exposes get/set/clear for request tags and comment', () => {
    const api = createScriptApi({
      ...baseInput,
      request: {
        ...baseInput.request,
        tags: 'api, smoke',
        comment: 'Initial note'
      }
    });
    const hc = api.hc as {
      request: {
        notes: {
          get: {
            (): { tags: string; comment: string };
            (field: 'tags' | 'comment'): string;
          };
          set: {
            (entries: { tags?: unknown; comment?: unknown }): void;
            (field: 'tags' | 'comment', value: unknown): void;
          };
          clear: () => void;
        };
      };
    };

    expect(hc.request.notes.get()).toEqual({ tags: 'api, smoke', comment: 'Initial note' });
    expect(hc.request.notes.get('tags')).toBe('api, smoke');

    hc.request.notes.set({ tags: 'foo, bar', comment: 'Hello world' });
    expect(hc.request.notes.get('comment')).toBe('Hello world');

    hc.request.notes.set('tags', 'updated');
    expect(hc.request.notes.get('tags')).toBe('updated');

    hc.request.notes.clear();
    expect(hc.request.notes.get()).toEqual({ tags: '', comment: '' });

    const result = api.readResult();
    expect(result.request.tags).toBe('');
    expect(result.request.comment).toBe('');
  });
});

describe('createScriptApi hc.data', () => {
  it('seeds hc.data from input and returns mutations in readResult', () => {
    const api = createScriptApi({
      ...baseInput,
      data: { seed: 'value' }
    });
    const hc = api.hc as { data: Record<string, unknown> };

    expect(hc.data).toEqual({ seed: 'value' });
    hc.data.mocks = { user: { id: 1 } };
    expect(api.readResult().data).toEqual({ seed: 'value', mocks: { user: { id: 1 } } });
  });

  it('supports full reassignment via hc.data setter', () => {
    const api = createScriptApi({
      ...baseInput,
      data: { original: true }
    });
    const hc = api.hc as { data: Record<string, unknown> };

    hc.data = { replaced: true };
    expect(api.readResult().data).toEqual({ replaced: true });
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

describe('createScriptApi hc.fs', () => {
  it('bridges fs and parse calls through fileBridge', async () => {
    const ops: string[] = [];
    const api = createScriptApi(baseInput, {
      fileBridge: async (req) => {
        ops.push(req.op);
        if (req.op === 'readText') {
          return 'from-disk';
        }
        if (req.op === 'parseYaml') {
          return { a: 1 };
        }
        return undefined;
      }
    });
    const hc = api.hc as {
      fs: { readText: (path: string) => Promise<string> };
      parse: { yaml: (text: string) => Promise<{ a: number }> };
    };

    expect(await hc.fs.readText('a.txt')).toBe('from-disk');
    expect(await hc.parse.yaml('a: 1')).toEqual({ a: 1 });
    expect(ops).toEqual(['readText', 'parseYaml']);
  });

  it('throws when fileBridge is unavailable', async () => {
    const api = createScriptApi(baseInput);
    const readText = (api.hc.fs as { readText: (path: string) => Promise<string> }).readText;

    await expect(readText('a.txt')).rejects.toThrow(
      'hc.fs is not available in this script context'
    );
  });
});
