import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { Collection } from '#/shared/types';
import type { RequestDraft } from '#/renderer/src/store/tabs';
import {
  pluginRequestKey,
  toPluginRequestDraft,
  toPluginRequestTabContext
} from './pluginContextAdapters';

/**
 * Returns a minimal store draft for adapter tests.
 */
function sampleDraft(overrides: Partial<RequestDraft> = {}): RequestDraft {
  return {
    name: 'Sample',
    method: 'POST',
    url: 'https://example.com',
    headers: [{ key: 'X-Custom', value: '1', enabled: true }],
    params: [{ key: 'q', value: 'test', enabled: true }],
    auth: {
      ...defaultAuth(),
      type: 'bearer',
      bearer: { token: 'draft-token' }
    },
    body: '{"ok":true}',
    body_type: 'json',
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    ...overrides
  };
}

/**
 * Returns a minimal collection for adapter tests.
 */
function sampleCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 1,
    uuid: '00000000-0000-0000-0000-000000000001',
    name: 'API',
    headers: [{ key: 'X-Collection', value: 'yes', enabled: true }],
    variables: [],
    auth: {
      ...defaultAuth(),
      type: 'basic',
      basic: { username: 'alice', password: 'secret' }
    },
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('toPluginRequestDraft', () => {
  it('maps auth and body_type from the store draft', () => {
    const draft = sampleDraft();
    expect(toPluginRequestDraft(draft)).toMatchObject({
      method: 'POST',
      url: 'https://example.com',
      auth: draft.auth,
      body_type: 'json'
    });
  });
});

describe('toPluginRequestTabContext', () => {
  it('includes collection auth and headers with normalized defaults', () => {
    const context = toPluginRequestTabContext(sampleDraft(), sampleCollection(), null, {
      host: 'example.com'
    });

    expect(context.readOnly).toBe(true);
    expect(context.response).toBeNull();
    expect(context.draft.auth.type).toBe('bearer');
    expect(context.collectionAuth.type).toBe('basic');
    expect(context.collectionHeaders).toEqual([
      { key: 'X-Collection', value: 'yes', enabled: true }
    ]);
    expect(context.variables).toEqual({ host: 'example.com' });
  });

  it('uses default auth and empty headers when collection is undefined', () => {
    const context = toPluginRequestTabContext(sampleDraft(), undefined, null, {});

    expect(context.collectionAuth).toEqual(defaultAuth());
    expect(context.collectionHeaders).toEqual([]);
  });

  it('uses req:<id> for saved requests and METHOD url for unsaved tabs', () => {
    const saved = toPluginRequestTabContext(sampleDraft({ id: 42 }), undefined, null, {});
    expect(saved.requestKey).toBe('req:42');

    const unsaved = toPluginRequestTabContext(
      sampleDraft({ method: 'GET', url: ' https://example.com ' }),
      undefined,
      null,
      {}
    );
    expect(unsaved.requestKey).toBe('GET https://example.com');
  });
});

describe('pluginRequestKey', () => {
  it('returns req:<id> when the draft has a saved id', () => {
    expect(pluginRequestKey(sampleDraft({ id: 7 }))).toBe('req:7');
  });

  it('returns METHOD url when the draft is unsaved', () => {
    expect(pluginRequestKey(sampleDraft({ method: 'POST', url: 'https://api.test' }))).toBe(
      'POST https://api.test'
    );
  });
});
