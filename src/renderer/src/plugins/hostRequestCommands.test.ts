import { describe, expect, it } from 'vitest';
import type { SavedRequest } from '#/shared/types';
import { defaultAuth } from '#/shared/auth';
import {
  draftFromOpenPayload,
  findSavedRequest,
  logRequestToConsole,
  pluginRequestToSaveInput,
  uniqueFolderNames,
  validateCreateCollectionPayload,
  validatePluginConsoleLogPayload
} from './hostRequestCommands';
import { store } from '#/renderer/src/store/redux';
import { clearConsole } from '#/renderer/src/store/slices/consoleSlice';
import { toPluginHttpRequest } from '#/shared/plugin/httpRequest';
import type { RootState } from '#/renderer/src/store/redux';

describe('toPluginHttpRequest', () => {
  it('includes source request metadata and enabled params for plugin hooks', () => {
    const request = toPluginHttpRequest({
      method: 'POST',
      url: 'https://example.com/users',
      headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
      params: [{ key: 'page', value: '1', enabled: true }],
      body: '{"name":"Ada"}',
      bodyType: 'json',
      sourceRequestId: 42,
      sourceRequestName: 'Create user'
    });

    expect(request).toEqual({
      method: 'POST',
      url: 'https://example.com/users',
      headers: { Authorization: 'Bearer token' },
      body: '{"name":"Ada"}',
      bodyType: 'json',
      params: [{ key: 'page', value: '1' }],
      sourceRequestId: 42,
      sourceRequestName: 'Create user'
    });
  });
});

describe('hostRequestCommands', () => {
  it('builds a draft tab payload from captured recent-request metadata', () => {
    const draft = draftFromOpenPayload({
      name: 'Create user',
      method: 'POST',
      url: 'https://example.com/users',
      headers: { Authorization: 'Bearer token' },
      params: [{ key: 'page', value: '1' }],
      body: '{"name":"Ada"}',
      bodyType: 'json'
    });

    expect(draft.name).toBe('Create user');
    expect(draft.method).toBe('POST');
    expect(draft.url).toBe('https://example.com/users');
    expect(draft.headers).toEqual([{ key: 'Authorization', value: 'Bearer token', enabled: true }]);
    expect(draft.params).toEqual([{ key: 'page', value: '1', enabled: true }]);
    expect(draft.body).toBe('{"name":"Ada"}');
    expect(draft.body_type).toBe('json');
  });

  it('finds a saved request in the Redux cache by id', () => {
    const saved: SavedRequest = {
      id: 42,
      uuid: 'req-42',
      collection_id: 1,
      name: 'Create user',
      method: 'POST',
      url: 'https://example.com/users',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      folder_id: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    };

    const state = {
      collections: {
        requestsByCollection: {
          1: [saved]
        }
      }
    } as unknown as RootState;

    expect(findSavedRequest(state, 42)).toEqual(saved);
    expect(findSavedRequest(state, 99)).toBeUndefined();
  });

  it('validates bulk collection payloads and maps plugin requests to save input', () => {
    expect(validateCreateCollectionPayload({ name: ' API ', requests: [] })).toEqual({
      name: 'API',
      requests: []
    });

    expect(
      uniqueFolderNames([
        { name: 'A', folder: 'pets' },
        { name: 'B', folder: 'users' },
        { name: 'C', folder: 'pets' }
      ])
    ).toEqual(['pets', 'users']);

    const saveInput = pluginRequestToSaveInput(
      {
        name: 'List pets',
        method: 'get',
        url: 'https://example.com/pets',
        headers: { Accept: 'application/json' },
        params: [{ key: 'limit', value: '10' }],
        body: '{"ok":true}',
        bodyType: 'json',
        folder: 'pets',
        comment: 'Generated from OpenAPI'
      },
      7,
      3
    );

    expect(saveInput.collection_id).toBe(7);
    expect(saveInput.folder_id).toBe(3);
    expect(saveInput.name).toBe('List pets');
    expect(saveInput.method).toBe('GET');
    expect(saveInput.url).toBe('https://example.com/pets');
    expect(saveInput.body_type).toBe('json');
    expect(saveInput.comment).toBe('Generated from OpenAPI');
  });

  it('rejects invalid bulk collection payloads', () => {
    expect(() => validateCreateCollectionPayload(null)).toThrow(/payload object/);
    expect(() => validateCreateCollectionPayload({ name: ' ', requests: [] })).toThrow(
      /name is required/
    );
    expect(() => validateCreateCollectionPayload({ name: 'API', requests: 'bad' })).toThrow(
      /must be an array/
    );
    expect(() => pluginRequestToSaveInput({ name: ' ' }, 1, null)).toThrow(/non-empty name/);
  });

  it('appends plugin request results to the footer console log', () => {
    store.dispatch(clearConsole());

    logRequestToConsole({
      requestName: 'Health check',
      collectionName: 'API',
      result: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}',
        timeMs: 42,
        sizeBytes: 13,
        request: {
          method: 'GET',
          url: 'https://example.com/health',
          headers: { Accept: 'application/json' },
          body: '',
          bodyType: 'none'
        }
      }
    });

    const entry = store.getState().console.consoleEntries[0];
    expect(entry?.requestName).toBe('Health check');
    expect(entry?.collectionName).toBe('API');
    expect(entry?.result.status).toBe(200);
    expect(entry?.result.request?.method).toBe('GET');
    expect(entry?.result.request?.url).toBe('https://example.com/health');
    expect(entry?.result.timeMs).toBe(42);

    store.dispatch(clearConsole());
  });

  it('rejects invalid plugin console payloads', () => {
    expect(() => validatePluginConsoleLogPayload(null)).toThrow(/payload object/);
    expect(() => validatePluginConsoleLogPayload({ requestName: ' ', result: {} })).toThrow(
      /requestName/
    );
    expect(() =>
      validatePluginConsoleLogPayload({
        requestName: 'Health',
        result: { status: '200', timeMs: 1 }
      })
    ).toThrow(/result.status and result.timeMs/);
  });
});
