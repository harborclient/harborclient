import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import {
  applyAuthPatch,
  applyRequestDraftUpdate,
  applyScriptUpdate,
  hasRequestUpdateFields,
  mergeKeyValues,
  type AiRequestDraft
} from '#/shared/aiRequestUpdate';

/**
 * Returns a sample draft for update tests.
 */
function sampleDraft(): AiRequestDraft {
  return {
    name: 'Sample',
    method: 'GET',
    url: 'https://example.com?page=1',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    params: [{ key: 'page', value: '1', enabled: true }],
    auth: defaultAuth(),
    body: '',
    body_type: 'none',
    pre_request_script: 'console.log("before");',
    post_request_script: '',
    comment: 'notes'
  };
}

describe('mergeKeyValues', () => {
  it('merges rows by key and keeps a trailing blank row', () => {
    const current = [{ key: 'Accept', value: 'text/plain', enabled: true }];
    const result = mergeKeyValues(current, [{ key: 'Accept', value: 'application/json' }], 'merge');

    expect(result).toEqual([
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: '', value: '', enabled: true }
    ]);
  });

  it('replaces the entire table when mode is replace', () => {
    const current = [{ key: 'Accept', value: 'text/plain', enabled: true }];
    const result = mergeKeyValues(current, [{ key: 'X-Test', value: '1' }], 'replace');

    expect(result).toEqual([
      { key: 'X-Test', value: '1', enabled: true },
      { key: '', value: '', enabled: true }
    ]);
  });
});

describe('applyScriptUpdate', () => {
  it('appends script text with a newline separator', () => {
    expect(applyScriptUpdate('line1', 'line2', 'append')).toBe('line1\nline2');
  });

  it('replaces script text by default', () => {
    expect(applyScriptUpdate('old', 'new', 'replace')).toBe('new');
  });
});

describe('applyAuthPatch', () => {
  it('merges bearer token fields', () => {
    const result = applyAuthPatch(defaultAuth(), {
      type: 'bearer',
      bearer: { token: 'secret' }
    });

    expect(result.type).toBe('bearer');
    expect(result.bearer.token).toBe('secret');
  });
});

describe('hasRequestUpdateFields', () => {
  it('returns false for an empty patch', () => {
    expect(hasRequestUpdateFields({})).toBe(false);
  });

  it('returns true when any supported field is present', () => {
    expect(hasRequestUpdateFields({ comment: 'updated' })).toBe(true);
  });
});

describe('applyRequestDraftUpdate', () => {
  it('appends a post-request script', () => {
    const draft = { ...sampleDraft(), post_request_script: 'existing();' };
    const result = applyRequestDraftUpdate(draft, {
      post_request_script: "hc.test('ok', () => {});",
      post_request_script_mode: 'append'
    });

    expect(result.draft.post_request_script).toBe("existing();\nhc.test('ok', () => {});");
    expect(result.changedFields).toContain('post_request_script');
  });

  it('syncs params from a url-only change', () => {
    const draft = sampleDraft();
    const result = applyRequestDraftUpdate(draft, {
      url: 'https://example.com?limit=10'
    });

    expect(result.draft.url).toBe('https://example.com?limit=10');
    expect(result.draft.params.some((row) => row.key === 'limit' && row.value === '10')).toBe(true);
    expect(result.changedFields).toEqual(expect.arrayContaining(['url', 'params']));
  });

  it('syncs url from a params change', () => {
    const draft = sampleDraft();
    const result = applyRequestDraftUpdate(draft, {
      params: [{ key: 'page', value: '2' }],
      params_mode: 'replace'
    });

    expect(result.draft.url).toBe('https://example.com?page=2');
    expect(result.changedFields).toEqual(expect.arrayContaining(['params', 'url']));
  });

  it('merges headers by key', () => {
    const draft = sampleDraft();
    const result = applyRequestDraftUpdate(draft, {
      headers: [{ key: 'Authorization', value: 'Bearer token' }]
    });

    expect(result.draft.headers.some((row) => row.key === 'Authorization')).toBe(true);
    expect(result.draft.headers.some((row) => row.key === 'Accept')).toBe(true);
  });

  it('flags cookie updates without changing the draft', () => {
    const draft = sampleDraft();
    const result = applyRequestDraftUpdate(draft, {
      cookies: [{ key: 'session', value: 'abc' }]
    });

    expect(result.hasCookieUpdate).toBe(true);
    expect(result.changedFields).toContain('cookies');
    expect(result.draft).toEqual(draft);
  });
});
