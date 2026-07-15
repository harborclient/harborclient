import { describe, expect, it } from 'vitest';
import {
  applyCollectionVariableSets,
  applyCookieChanges,
  applyRuntimeVariableClears,
  applyScriptRequestMutations,
  applyVariableClears,
  buildRuntimeVars,
  buildScriptSlots,
  mergeVariableSets,
  substituteWithMap
} from './scriptOrchestration';
import { createInlineScriptRef, createSnippetScriptRef } from '#/shared/scriptRefs';
import { defaultAuth } from '#/shared/auth';
import type { ScriptRunResult, Snippet } from '#/shared/types';

const snippetLookup = new Map<string, Snippet>([
  [
    'snippet-1',
    {
      id: 1,
      uuid: 'snippet-1',
      name: 'Auth helper',
      code: "hc.request.variables.set('token', 'live');",
      scope: 'any',
      stage: 'main',
      source: 'local',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    }
  ]
]);

describe('buildRuntimeVars', () => {
  it('resolves value and defaultValue', () => {
    expect(
      buildRuntimeVars([
        { key: 'host', value: 'api.example.com', defaultValue: 'localhost', share: false },
        { key: 'token', value: '', defaultValue: 'fallback', share: false }
      ])
    ).toEqual({
      host: 'api.example.com',
      token: 'fallback'
    });
  });
});

describe('substituteWithMap', () => {
  it('replaces known tokens', () => {
    expect(substituteWithMap('https://{{host}}/api', { host: 'example.com' })).toBe(
      'https://example.com/api'
    );
  });

  it('leaves unknown tokens unchanged', () => {
    expect(substituteWithMap('{{known}}/{{missing}}', { known: 'ok' })).toBe('ok/{{missing}}');
  });

  it('resolves dynamic variables when no runtime value is defined', () => {
    const result = substituteWithMap('{{$timestamp}}', {});
    expect(result).toMatch(/^\d+$/);
  });

  it('prefers runtime variables over dynamic variables with the same key', () => {
    expect(substituteWithMap('{{$randomInt}}', { $randomInt: '99' })).toBe('99');
  });

  it('can produce different values for repeated dynamic tokens in one string', () => {
    const result = substituteWithMap('{{$randomInt}}-{{$randomInt}}', {});
    const [first, second] = result.split('-');
    expect(first).toMatch(/^\d+$/);
    expect(second).toMatch(/^\d+$/);
  });

  it('applies chained filters to resolved values', () => {
    expect(substituteWithMap('{{name|trim|upper}}', { name: '  hello  ' })).toBe('HELLO');
  });

  it('leaves tokens unchanged when a filter is unknown', () => {
    expect(substituteWithMap('{{name|unknown}}', { name: 'hello' })).toBe('{{name|unknown}}');
  });
});

describe('mergeVariableSets', () => {
  it('merges ephemeral sets over runtime vars', () => {
    expect(mergeVariableSets({ a: '1', b: '2' }, { b: 'updated', c: '3' })).toEqual({
      a: '1',
      b: 'updated',
      c: '3'
    });
  });
});

describe('applyCollectionVariableSets', () => {
  it('updates existing keys and appends new ones', () => {
    expect(
      applyCollectionVariableSets(
        [{ key: 'token', value: 'old', defaultValue: 'fallback', share: false }],
        { token: 'new', apiKey: 'secret' }
      )
    ).toEqual([
      { key: 'token', value: 'new', defaultValue: 'fallback', share: false },
      { key: 'apiKey', value: 'secret', defaultValue: '', share: false }
    ]);
  });
});

describe('applyVariableClears', () => {
  it('removes cleared keys from persisted variable rows', () => {
    expect(
      applyVariableClears(
        [
          { key: 'token', value: 'abc', defaultValue: '', share: false },
          { key: 'host', value: 'example.com', defaultValue: '', share: false }
        ],
        ['token']
      )
    ).toEqual([{ key: 'host', value: 'example.com', defaultValue: '', share: false }]);
  });
});

describe('applyRuntimeVariableClears', () => {
  it('removes cleared keys from the runtime map', () => {
    expect(applyRuntimeVariableClears({ token: 'abc', host: 'example.com' }, ['token'])).toEqual({
      host: 'example.com'
    });
  });
});

describe('applyCookieChanges', () => {
  it('applies cookie sets and clears on seeded rows', () => {
    expect(
      applyCookieChanges(
        [
          { key: 'session', value: 'old', enabled: true },
          { key: 'theme', value: 'dark', enabled: true }
        ],
        { session: 'new' },
        ['theme']
      )
    ).toEqual([{ key: 'session', value: 'new', enabled: true }]);
  });
});

describe('applyScriptRequestMutations', () => {
  it('applies request mutations from script result', () => {
    const current = {
      method: 'GET' as const,
      url: 'https://old.example',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      params: [{ key: 'q', value: 'search', enabled: true }],
      body: '',
      bodyType: 'none' as const,
      auth: defaultAuth()
    };
    const result: ScriptRunResult = {
      request: {
        method: 'POST',
        url: 'https://new.example',
        headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
        params: [{ key: 'page', value: '2', enabled: true }],
        body: '{"ok":true}',
        bodyType: 'json',
        auth: {
          ...defaultAuth(),
          type: 'bearer',
          bearer: { token: 'script-token' }
        },
        tags: 'scripted',
        comment: 'Updated by script'
      },
      variableSets: {},
      variableClears: [],
      collectionVariableSets: {},
      collectionVariableClears: [],
      folderVariableSets: {},
      folderVariableClears: [],
      environmentVariableSets: {},
      environmentVariableClears: [],
      globalVariableSets: {},
      globalVariableClears: [],
      cookieSets: {},
      cookieClears: [],
      collectionHeaders: [],
      folderHeaders: [],
      tests: [],
      logs: [],
      executionEvents: [],
      data: {}
    };

    expect(applyScriptRequestMutations(current, result)).toEqual({
      method: 'POST',
      url: 'https://new.example',
      headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
      params: [{ key: 'page', value: '2', enabled: true }],
      body: '{"ok":true}',
      bodyType: 'none',
      auth: {
        ...defaultAuth(),
        type: 'bearer',
        bearer: { token: 'script-token' }
      },
      tags: 'scripted',
      comment: 'Updated by script'
    });
  });
});

describe('buildScriptSlots', () => {
  it('returns collection then request pre scripts from legacy strings', () => {
    expect(
      buildScriptSlots(
        [],
        [],
        [],
        [],
        [],
        [],
        'collection pre',
        '',
        '',
        '',
        'request pre',
        '',
        'pre',
        snippetLookup
      ).map((slot) => slot.label)
    ).toEqual(['Collection pre-request script 1', 'Request pre-request script 1']);
  });

  it('returns collection then request post scripts from legacy strings', () => {
    expect(
      buildScriptSlots(
        [],
        [],
        [],
        [],
        [],
        [],
        '',
        'collection post',
        '',
        '',
        '',
        'request post',
        'post',
        snippetLookup
      ).map((slot) => slot.label)
    ).toEqual(['Collection post-request script 1', 'Request post-request script 1']);
  });

  it('expands inline and snippet references in order', () => {
    const slots = buildScriptSlots(
      [createInlineScriptRef('collection inline')],
      [],
      [],
      [],
      [createSnippetScriptRef('snippet-1', 'Auth helper')],
      [],
      '',
      '',
      '',
      '',
      '',
      '',
      'pre',
      snippetLookup
    );

    expect(slots).toHaveLength(2);
    expect(slots[0]?.source).toBe('collection inline');
    expect(slots[1]?.source).toBe("hc.request.variables.set('token', 'live');");
  });

  it('filters empty scripts', () => {
    expect(
      buildScriptSlots(
        [],
        [],
        [],
        [],
        [createInlineScriptRef('request pre')],
        [],
        '',
        '',
        '',
        '',
        '',
        '',
        'pre',
        snippetLookup
      )
    ).toHaveLength(1);
  });
});

describe('script substitution chain', () => {
  it('uses updated runtime vars for later scripts', () => {
    let runtimeVars = buildRuntimeVars([
      { key: 'token', value: '', defaultValue: 'initial', share: false }
    ]);
    runtimeVars = mergeVariableSets(runtimeVars, { token: 'updated' });

    const scriptSource = 'const t = "{{token}}";';
    expect(substituteWithMap(scriptSource, runtimeVars)).toBe('const t = "updated";');
  });
});
