import { describe, expect, it } from 'vitest';
import type { SavedRequest } from '#/shared/types';
import { draftFromOpenPayload, findSavedRequest } from '#/renderer/src/plugins/hostRequestCommands';
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
      auth: { type: 'none', basic: { username: '', password: '' }, bearer: { token: '' } },
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      comment: '',
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
});
