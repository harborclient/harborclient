import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScriptApi } from './scriptApi';
import { defaultAuth } from '@harborclient/core/auth';
import type { SendResult } from '@harborclient/core/types';

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
        iteration: 0,
        workflowId: '',
        workflowActionId: '',
        workflowActionIteration: -1,
        livepageId: '',
        liveserverId: ''
      }
    });
    const info = api.hc.info as {
      eventName: string;
      requestName: string;
      requestId: string;
      iteration: number;
      workflowId: string;
      workflowActionId: string;
      workflowActionIteration: number;
      livepageId: string;
    };

    expect(info.eventName).toBe('test');
    expect(info.requestName).toBe('Login');
    expect(info.requestId).toBe('42');
    expect(info.iteration).toBe(0);
    expect(info.workflowId).toBe('');
    expect(info.workflowActionId).toBe('');
    expect(info.workflowActionIteration).toBe(-1);
    expect(info.livepageId).toBe('');
  });

  it('defaults info from phase when input.info is omitted', () => {
    const api = createScriptApi(baseInput);
    const info = api.hc.info as {
      eventName: string;
      requestName: string;
      requestId: string;
      iteration: number;
      workflowId: string;
      workflowActionId: string;
      workflowActionIteration: number;
      livepageId: string;
    };

    expect(info.eventName).toBe('prerequest');
    expect(info.requestName).toBe('');
    expect(info.requestId).toBe('');
    expect(info.iteration).toBe(0);
    expect(info.workflowId).toBe('');
    expect(info.workflowActionId).toBe('');
    expect(info.workflowActionIteration).toBe(-1);
    expect(info.livepageId).toBe('');
  });

  it('exposes workflow metadata when provided on input.info', () => {
    const api = createScriptApi({
      ...baseInput,
      info: {
        eventName: 'prerequest',
        requestName: 'Send',
        requestId: '1',
        iteration: 0,
        workflowId: 'wf-1',
        workflowActionId: 'act-2',
        workflowActionIteration: 4,
        livepageId: '',
        liveserverId: ''
      }
    });
    const info = api.hc.info as {
      workflowId: string;
      workflowActionId: string;
      workflowActionIteration: number;
    };

    expect(info.workflowId).toBe('wf-1');
    expect(info.workflowActionId).toBe('act-2');
    expect(info.workflowActionIteration).toBe(4);
  });

  it('exposes livepageId when provided on input.info', () => {
    const api = createScriptApi({
      ...baseInput,
      info: {
        eventName: 'prerequest',
        requestName: '',
        requestId: '',
        iteration: 0,
        workflowId: '',
        workflowActionId: '',
        workflowActionIteration: -1,
        livepageId: 'website-uuid',
        liveserverId: ''
      }
    });
    const info = api.hc.info as { livepageId: string };

    expect(info.livepageId).toBe('website-uuid');
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

  it('clears a namespace prefix across bags without touching the bare namespace key', () => {
    const api = createScriptApi({
      ...baseInput,
      variables: {
        'workflow_a.foo': 'seed-foo',
        'workflow_a.foo.bar': 'seed-bar',
        'workflow_a': 'bare',
        'host': 'example.com'
      },
      environment: { name: 'Production' },
      folder: { id: 1, name: 'Auth', headers: [] }
    });
    const hc = api.hc as {
      request: {
        variables: {
          set: (k: string, v: string) => void;
          get: (k: string) => string | undefined;
          clear: (k: string) => void;
        };
      };
      collection: {
        variables: {
          set: (k: string, v: string) => void;
          get: (k: string) => string | undefined;
          clear: (k: string) => void;
        };
      };
      folder: {
        variables: {
          set: (k: string, v: string) => void;
          get: (k: string) => string | undefined;
          clear: (k: string) => void;
        };
      };
      environment: {
        variables: {
          set: (k: string, v: string) => void;
          get: (k: string) => string | undefined;
          clear: (k: string) => void;
        };
      };
      globals: {
        set: (k: string, v: string) => void;
        get: (k: string) => string | undefined;
        clear: (k: string) => void;
      };
    };

    hc.collection.variables.set('workflow_a.foo', 'collection');
    hc.folder.variables.set('workflow_a.nested', 'folder');
    hc.environment.variables.set('workflow_a.token', 'environment');
    hc.globals.set('workflow_a.global', 'global');
    hc.request.variables.set('workflow_a.req', 'request');

    hc.collection.variables.clear('workflow_a.*');
    hc.folder.variables.clear('workflow_a.*');
    hc.environment.variables.clear('workflow_a.*');
    hc.globals.clear('workflow_a.*');
    hc.request.variables.clear('workflow_a.*');

    expect(hc.collection.variables.get('workflow_a.foo')).toBeUndefined();
    expect(hc.collection.variables.get('workflow_a.foo.bar')).toBeUndefined();
    expect(hc.collection.variables.get('workflow_a')).toBe('bare');
    expect(hc.collection.variables.get('host')).toBe('example.com');
    expect(hc.folder.variables.get('workflow_a.nested')).toBeUndefined();
    expect(hc.environment.variables.get('workflow_a.token')).toBeUndefined();
    expect(hc.globals.get('workflow_a.global')).toBeUndefined();
    expect(hc.request.variables.get('workflow_a.req')).toBeUndefined();

    const result = api.readResult();
    expect(result.collectionVariableClears).toEqual(['workflow_a.*']);
    expect(result.folderVariableClears).toEqual(['workflow_a.*']);
    expect(result.environmentVariableClears).toEqual(['workflow_a.*']);
    expect(result.globalVariableClears).toEqual(['workflow_a.*']);
    expect(result.variableClears).toEqual(['workflow_a.*']);
    expect(result.collectionVariableSets).toEqual({});
    expect(result.folderVariableSets).toEqual({});
    expect(result.environmentVariableSets).toEqual({});
    expect(result.globalVariableSets).toEqual({});
    expect(result.variableSets).toEqual({});
  });

  it('set after namespace clear restores that key while keeping the pattern clear', () => {
    const api = createScriptApi({
      ...baseInput,
      variables: {
        'workflow_a.foo': 'seed-foo',
        'workflow_a.bar': 'seed-bar'
      }
    });
    const hc = api.hc as {
      collection: {
        variables: {
          set: (k: string, v: string) => void;
          get: (k: string) => string | undefined;
          clear: (k: string) => void;
        };
      };
    };

    hc.collection.variables.clear('workflow_a.*');
    hc.collection.variables.set('workflow_a.foo', 'restored');

    expect(hc.collection.variables.get('workflow_a.foo')).toBe('restored');
    expect(hc.collection.variables.get('workflow_a.bar')).toBeUndefined();

    const result = api.readResult();
    expect(result.collectionVariableClears).toEqual(['workflow_a.*']);
    expect(result.collectionVariableSets).toEqual({ 'workflow_a.foo': 'restored' });
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

  it('records workflowNextAction and workflowSkipAction when running in a workflow', () => {
    const api = createScriptApi({
      ...baseInput,
      info: {
        eventName: 'prerequest',
        requestName: '',
        requestId: '',
        iteration: 0,
        workflowId: 'wf-uuid',
        workflowActionId: 'act-current',
        workflowActionIteration: 1,
        livepageId: '',
        liveserverId: ''
      }
    });
    const hc = api.hc as {
      execution: {
        workflowNextAction: (actionId: string) => void;
        workflowSkipAction: () => void;
      };
    };

    hc.execution.workflowNextAction('act-target');
    hc.execution.workflowSkipAction();

    const result = api.readResult();
    expect(result.workflowNextAction).toBe('act-target');
    expect(result.workflowSkipAction).toBe(true);
    expect(result.executionEvents).toEqual([
      { type: 'flow', action: 'workflow-next-action', workflowNextAction: 'act-target' },
      { type: 'flow', action: 'workflow-skip-action' }
    ]);
  });

  it('no-ops workflowNextAction and workflowSkipAction outside a workflow', () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      execution: {
        workflowNextAction: (actionId: string) => void;
        workflowSkipAction: () => void;
      };
    };

    hc.execution.workflowNextAction('act-target');
    hc.execution.workflowSkipAction();

    const result = api.readResult();
    expect(result.workflowNextAction).toBeUndefined();
    expect(result.workflowSkipAction).toBeUndefined();
    expect(result.executionEvents).toEqual([]);
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

describe('createScriptApi hc.ask', () => {
  it('returns null when no ask transport is available', async () => {
    const api = createScriptApi(baseInput);
    const ask = api.hc.ask as (
      prompt: string,
      options?: { model?: string }
    ) => Promise<string | null>;

    await expect(ask('Summarize this', { model: 'GPT-4o Mini: Personal' })).resolves.toBeNull();
  });

  it('forwards normalized args through the ask transport', async () => {
    const calls: Array<{ prompt: string; model?: string }> = [];
    const api = createScriptApi(baseInput, {
      ask: async (req) => {
        calls.push(req);
        return 'hello from model';
      }
    });
    const ask = api.hc.ask as (
      prompt: string,
      options?: { model?: string }
    ) => Promise<string | null>;

    await expect(ask('  Summarize this  ', { model: ' GPT-4o Mini: Personal ' })).resolves.toBe(
      'hello from model'
    );
    expect(calls).toEqual([{ prompt: 'Summarize this', model: 'GPT-4o Mini: Personal' }]);
  });

  it('allows omitting options and model', async () => {
    const calls: Array<{ prompt: string; model?: string }> = [];
    const api = createScriptApi(baseInput, {
      ask: async (req) => {
        calls.push(req);
        return 'default model';
      }
    });
    const ask = api.hc.ask as (
      prompt: string,
      options?: { model?: string }
    ) => Promise<string | null>;

    await expect(ask('Hello')).resolves.toBe('default model');
    await expect(ask('Hello', {})).resolves.toBe('default model');
    expect(calls).toEqual([{ prompt: 'Hello' }, { prompt: 'Hello' }]);
  });

  it('throws when prompt is empty or options is not an object', async () => {
    const api = createScriptApi(baseInput, {
      ask: async () => 'unused'
    });
    const ask = api.hc.ask as (prompt: string, options?: unknown) => Promise<string | null>;

    await expect(ask('', { model: 'gpt-4o' })).rejects.toThrow('hc.ask requires a prompt');
    await expect(ask('Hi', 'gpt-4o')).rejects.toThrow('hc.ask options must be an object');
  });
});

describe('createScriptApi hc.sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the given delay', async () => {
    const api = createScriptApi(baseInput);
    const sleep = api.hc.sleep as (milliseconds: number) => Promise<void>;
    let resolved = false;

    const pending = sleep(2000).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(1999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });

  it('throws when milliseconds is not a non-negative finite number', () => {
    const api = createScriptApi(baseInput);
    const sleep = api.hc.sleep as (milliseconds: unknown) => Promise<void>;

    expect(() => sleep(-1)).toThrow(
      'hc.sleep requires a non-negative finite number of milliseconds'
    );
    expect(() => sleep(Number.NaN)).toThrow(
      'hc.sleep requires a non-negative finite number of milliseconds'
    );
    expect(() => sleep('nope')).toThrow(
      'hc.sleep requires a non-negative finite number of milliseconds'
    );
  });
});

describe('createScriptApi hc.send / hc.sendJSON', () => {
  it('records a text override with default status and content type', async () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      send: (text: string, statusCode?: number, contentType?: string) => Promise<void>;
    };

    await hc.send('hello');

    expect(api.readResult().responseOverride).toEqual({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'hello'
    });
    expect(api.readResult().executionEvents).toEqual([
      { type: 'flow', action: 'send-response', status: 200 }
    ]);
  });

  it('records an explicit status and content type', async () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      send: (text: string, statusCode?: number, contentType?: string) => Promise<void>;
    };

    await hc.send('oops', 400, 'text/html');

    expect(api.readResult().responseOverride).toEqual({
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'text/html' },
      body: 'oops'
    });
  });

  it('serializes JSON and sets application/json', async () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      sendJSON: (value: unknown, statusCode?: number) => Promise<void>;
    };

    await hc.sendJSON({ error: 'Something happened.' }, 400);

    expect(api.readResult().responseOverride).toEqual({
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
      body: '{"error":"Something happened."}'
    });
  });

  it('keeps the last call when send and sendJSON are both used', async () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      send: (text: string) => Promise<void>;
      sendJSON: (value: unknown, statusCode?: number) => Promise<void>;
    };

    await hc.send('first');
    await hc.sendJSON({ ok: true }, 201);

    const result = api.readResult();
    expect(result.responseOverride?.body).toBe('{"ok":true}');
    expect(result.responseOverride?.status).toBe(201);
    expect(result.executionEvents).toEqual([
      { type: 'flow', action: 'send-response', status: 200 },
      { type: 'flow', action: 'send-response', status: 201 }
    ]);
  });

  it('throws for an invalid status code', async () => {
    const api = createScriptApi(baseInput);
    const hc = api.hc as {
      send: (text: string, statusCode?: number) => Promise<void>;
      sendJSON: (value: unknown, statusCode?: number) => Promise<void>;
    };

    await expect(hc.send('x', 99)).rejects.toThrow(/100 and 599/);
    await expect(hc.sendJSON({}, 600)).rejects.toThrow(/100 and 599/);
    expect(api.readResult().responseOverride).toBeUndefined();
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

describe('createScriptApi hc.webpage', () => {
  it('throws when no webpage transport is available', async () => {
    const api = createScriptApi(baseInput);
    const webpage = api.hc.webpage as (url?: string) => Promise<unknown>;

    await expect(webpage('https://example.com')).rejects.toThrow(
      'hc.webpage is not available in this script context'
    );
  });

  it('opens a tab and forwards handle methods through the bridge', async () => {
    const calls: unknown[] = [];
    const fileCalls: Array<{ op: string; path?: string }> = [];
    const api = createScriptApi(baseInput, {
      webpage: async (req) => {
        calls.push(req);
        if (req.op === 'open') {
          return {
            tabId: 'tab-1',
            url: 'https://example.com/',
            title: 'Example',
            canGoBack: false,
            canGoForward: false
          };
        }
        if (req.op === 'focus') {
          return { ok: true };
        }
        if (req.op === 'close') {
          return { closed: true };
        }
        if (req.op === 'query') {
          return { selector: req.selector, matchCount: 1, elements: [{ tagName: 'H1' }] };
        }
        if (req.op === 'evaluate') {
          return { value: 'Example' };
        }
        if (req.op === 'injectScript') {
          return { value: undefined };
        }
        if (req.op === 'injectStylesheet') {
          return { key: 'css-1' };
        }
        if (req.op === 'screenshot') {
          return { pngBase64: Buffer.from('fake-png').toString('base64') };
        }
        return { error: `unexpected op` };
      },
      fileBridge: async (req) => {
        fileCalls.push(req);
        if (req.op === 'writeBytes') {
          return `/tmp/script-root/${req.path}`;
        }
        return undefined;
      }
    });

    const webpage = api.hc.webpage as (
      url?: string,
      options?: { reuse?: boolean }
    ) => Promise<{
      tabId: string;
      url: string;
      title: string;
      focus: () => Promise<void>;
      close: () => Promise<boolean>;
      screenshot: (path: string, options?: object) => Promise<{ path: string }>;
      dom: {
        query: (selector: string) => Promise<{ matchCount: number; elements: unknown[] }>;
        evaluate: (expression: string) => Promise<unknown>;
        injectScript: (source: string) => Promise<unknown>;
        injectStylesheet: (css: string) => Promise<string>;
      };
    }>;

    const page = await webpage('https://example.com', { reuse: false });
    expect(page.tabId).toBe('tab-1');
    expect(page.title).toBe('Example');
    await page.focus();
    await expect(page.dom.query('h1')).resolves.toEqual({
      selector: 'h1',
      matchCount: 1,
      elements: [{ tagName: 'H1' }]
    });
    await expect(page.dom.evaluate('document.title')).resolves.toBe('Example');
    await page.dom.injectScript('1+1');
    await expect(page.dom.injectStylesheet('body{}')).resolves.toBe('css-1');
    await expect(page.screenshot('screenshot.png', {})).resolves.toEqual({
      path: '/tmp/script-root/screenshot.png'
    });
    await expect(page.screenshot('full.png', { fullPage: true })).resolves.toEqual({
      path: '/tmp/script-root/full.png'
    });
    await expect(
      page.screenshot('bad.png', { fullPage: 'yes' as unknown as boolean })
    ).rejects.toThrow('options.fullPage must be a boolean');
    await expect(page.close()).resolves.toBe(true);

    expect(calls[0]).toEqual({ op: 'open', url: 'https://example.com', reuse: false });
    expect(calls).toContainEqual({ op: 'focus', tabId: 'tab-1' });
    expect(calls).toContainEqual({ op: 'screenshot', tabId: 'tab-1', fullPage: false });
    expect(calls).toContainEqual({ op: 'screenshot', tabId: 'tab-1', fullPage: true });
    expect(fileCalls.some((req) => req.op === 'writeBytes')).toBe(true);
    expect(calls).toContainEqual({
      op: 'query',
      tabId: 'tab-1',
      selector: 'h1',
      all: undefined,
      maxElements: undefined
    });
  });

  it('throws bridge error objects from open', async () => {
    const api = createScriptApi(baseInput, {
      webpage: async () => ({ error: 'No active browser tab.' })
    });
    const webpage = api.hc.webpage as (url?: string) => Promise<unknown>;
    await expect(webpage()).rejects.toThrow('No active browser tab.');
  });
});

describe('createScriptApi console', () => {
  it('captures log, error, warn, and debug with correct levels and methods', () => {
    const api = createScriptApi(baseInput);
    api.console.log('hello');
    api.console.error('boom');
    api.console.warn('careful');
    api.console.debug('detail');
    expect(api.readResult().logs).toEqual([
      { message: 'hello', level: 'log', method: 'log' },
      { message: 'boom', level: 'error', method: 'error' },
      { message: 'careful', level: 'warn', method: 'warn' },
      { message: 'detail', level: 'log', method: 'debug' }
    ]);
  });

  it('assert emits only when the condition is falsy', () => {
    const api = createScriptApi(baseInput);
    api.console.assert(true, 'ok');
    api.console.assert(false);
    api.console.assert(0, 'zero', 'bad');
    expect(api.readResult().logs).toEqual([
      { message: 'Assertion failed', level: 'error', method: 'assert' },
      { message: 'Assertion failed: zero bad', level: 'error', method: 'assert' }
    ]);
  });

  it('clear empties logs and resets group depth', () => {
    const api = createScriptApi(baseInput);
    api.console.group('outer');
    api.console.log('inside');
    api.console.clear();
    api.console.log('after');
    expect(api.readResult().logs).toEqual([{ message: 'after', level: 'log', method: 'log' }]);
  });

  it('indents messages inside groups', () => {
    const api = createScriptApi(baseInput);
    api.console.group('First');
    api.console.log('in first');
    api.console.groupCollapsed('Second');
    api.console.log('in second');
    api.console.groupEnd();
    api.console.log('back first');
    api.console.groupEnd();
    api.console.log('outer');
    expect(api.readResult().logs).toEqual([
      { message: 'First', level: 'log', method: 'group' },
      { message: '  in first', level: 'log', method: 'log' },
      { message: '  Second', level: 'log', method: 'groupCollapsed' },
      { message: '    in second', level: 'log', method: 'log' },
      { message: '  back first', level: 'log', method: 'log' },
      { message: 'outer', level: 'log', method: 'log' }
    ]);
  });

  it('table logs structured table data for object rows', () => {
    const api = createScriptApi(baseInput);
    api.console.table([
      { name: 'Ada', age: 36 },
      { name: 'Grace', age: 85 }
    ]);
    const logs = api.readResult().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0]?.level).toBe('log');
    expect(logs[0]?.method).toBe('table');
    expect(logs[0]?.table).toEqual({
      columns: ['(index)', 'name', 'age'],
      rows: [
        ['0', 'Ada', '36'],
        ['1', 'Grace', '85']
      ]
    });
    expect(logs[0]?.message).toContain('Ada');
  });

  it('time / timeLog / timeEnd emit elapsed timings', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const api = createScriptApi(baseInput);
    api.console.time('work');
    vi.setSystemTime(new Date('2024-01-01T00:00:00.050Z'));
    api.console.timeLog('work', 'checkpoint');
    vi.setSystemTime(new Date('2024-01-01T00:00:00.120Z'));
    api.console.timeEnd('work');
    expect(api.readResult().logs).toEqual([
      { message: 'work: 50ms checkpoint', level: 'log', method: 'timeLog' },
      { message: 'work: 120ms', level: 'log', method: 'timeEnd' }
    ]);
    vi.useRealTimers();
  });

  it('warns when timers are missing or duplicated', () => {
    const api = createScriptApi(baseInput);
    api.console.timeEnd('missing');
    api.console.time('dup');
    api.console.time('dup');
    expect(api.readResult().logs).toEqual([
      { message: "Timer 'missing' does not exist", level: 'warn', method: 'timeEnd' },
      { message: "Timer 'dup' already exists", level: 'warn', method: 'time' }
    ]);
  });

  it('trace emits a Trace header and stack frames', () => {
    const api = createScriptApi(baseInput);
    api.console.trace('here');
    const logs = api.readResult().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0]?.level).toBe('log');
    expect(logs[0]?.method).toBe('trace');
    expect(logs[0]?.message.startsWith('Trace: here')).toBe(true);
  });
});
