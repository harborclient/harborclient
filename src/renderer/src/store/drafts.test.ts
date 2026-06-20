import { describe, expect, it } from 'vitest';
import type { SavedRequest } from '#/shared/types';
import {
  cloneDraft,
  createTab,
  defaultDraft,
  draftFromSaved,
  emptyKeyValue,
  getDirtyTabs,
  isDraftDirty,
  isTabDirty,
  normalizeDraft,
  normalizeDraftForCompare,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts';

const sampleDraft = (): RequestDraft => ({
  name: 'Sample',
  method: 'POST',
  url: 'https://example.com',
  headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
  params: [{ key: 'page', value: '1', enabled: true }],
  body: '{"ok":true}',
  body_type: 'json',
  pre_request_script: '',
  post_request_script: '',
  comment: ''
});

describe('normalizeDraft', () => {
  it('fills missing script fields from legacy persisted tabs', () => {
    const legacy = {
      name: 'Legacy',
      method: 'GET' as const,
      url: '',
      headers: [emptyKeyValue()],
      params: [emptyKeyValue()],
      body: '',
      body_type: 'none' as const
    };

    expect(normalizeDraft(legacy as RequestDraft)).toEqual({
      ...legacy,
      pre_request_script: '',
      post_request_script: '',
      comment: ''
    });
  });
});

describe('cloneDraft', () => {
  it('deep-copies headers and params', () => {
    const draft = sampleDraft();
    const cloned = cloneDraft(draft);

    cloned.headers[0].value = 'changed';
    cloned.params[0].value = '2';

    expect(draft.headers[0].value).toBe('Bearer token');
    expect(draft.params[0].value).toBe('1');
    expect(cloned).not.toBe(draft);
  });
});

describe('normalizeDraftForCompare', () => {
  it('filters fully blank key/value rows', () => {
    const draft = sampleDraft();
    draft.headers.push(emptyKeyValue());
    draft.params.push({ key: '', value: 'value-only', enabled: true });

    const normalized = JSON.parse(normalizeDraftForCompare(draft));

    expect(normalized.headers).toEqual([
      { key: 'Authorization', value: 'Bearer token', enabled: true }
    ]);
    expect(normalized.params).toEqual([
      { key: 'page', value: '1', enabled: true },
      { key: '', value: 'value-only', enabled: true }
    ]);
  });

  it('is stable for equivalent drafts', () => {
    const left = sampleDraft();
    const right = sampleDraft();
    right.headers.push(emptyKeyValue());
    right.params.push(emptyKeyValue());

    expect(normalizeDraftForCompare(left)).toBe(normalizeDraftForCompare(right));
  });
});

describe('isDraftDirty', () => {
  it('returns false for identical drafts', () => {
    const draft = sampleDraft();
    expect(isDraftDirty(draft, cloneDraft(draft))).toBe(false);
  });

  it('returns true when drafts differ', () => {
    const draft = sampleDraft();
    const saved = cloneDraft(draft);
    draft.url = 'https://changed.example';

    expect(isDraftDirty(draft, saved)).toBe(true);
  });

  it('does not mark dirty when only trailing blank rows differ', () => {
    const draft = sampleDraft();
    const saved = cloneDraft(draft);
    draft.headers.push(emptyKeyValue());
    draft.params.push(emptyKeyValue());

    expect(isDraftDirty(draft, saved)).toBe(false);
  });
});

describe('isTabDirty', () => {
  it('delegates to draft dirty comparison', () => {
    const tab: RequestTab = createTab(sampleDraft());
    expect(isTabDirty(tab)).toBe(false);

    tab.draft.url = 'https://changed.example';
    expect(isTabDirty(tab)).toBe(true);
  });
});

describe('getDirtyTabs', () => {
  it('returns only tabs with unsaved changes', () => {
    const clean = createTab(sampleDraft());
    const dirty = createTab(sampleDraft());
    dirty.draft.url = 'https://changed.example';

    expect(getDirtyTabs([clean, dirty])).toEqual([dirty]);
    expect(getDirtyTabs([clean])).toEqual([]);
  });
});

describe('defaultDraft and emptyKeyValue', () => {
  it('returns expected default draft shape', () => {
    const draft = defaultDraft();

    expect(draft).toEqual({
      name: 'Untitled Request',
      method: 'GET',
      url: '',
      headers: [emptyKeyValue()],
      params: [emptyKeyValue()],
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      comment: ''
    });
  });

  it('returns a blank enabled key-value row', () => {
    expect(emptyKeyValue()).toEqual({ key: '', value: '', enabled: true });
  });
});

describe('createTab', () => {
  it('creates a tab with unique id and independent savedDraft', () => {
    const tabA = createTab(sampleDraft());
    const tabB = createTab(sampleDraft());

    expect(tabA.tabId).not.toBe(tabB.tabId);
    expect(tabA.savedDraft).not.toBe(tabA.draft);
    expect(tabA.response).toBeNull();
    expect(tabA.sending).toBe(false);
    expect(tabA.testResults).toEqual([]);

    tabA.draft.url = 'https://changed.example';
    expect(tabA.savedDraft.url).toBe('https://example.com');
  });
});

describe('draftFromSaved', () => {
  it('requestToDraft copies method, url, headers, params, body, and scripts from saved request', () => {
    const saved: SavedRequest = {
      id: 1,
      collection_id: 10,
      name: 'Saved',
      method: 'PUT',
      url: 'https://api.example.com',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      params: [{ key: 'q', value: 'search', enabled: true }],
      body: 'body',
      body_type: 'text',
      pre_request_script: '',
      post_request_script: '',
      comment: '',
      folder_id: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    };

    expect(draftFromSaved(saved)).toEqual({
      id: 1,
      collection_id: 10,
      folder_id: null,
      name: 'Saved',
      method: 'PUT',
      url: 'https://api.example.com',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      params: [{ key: 'q', value: 'search', enabled: true }],
      body: 'body',
      body_type: 'text',
      pre_request_script: '',
      post_request_script: '',
      comment: ''
    });
  });

  it('backfills empty headers and params with a blank row', () => {
    const saved: SavedRequest = {
      id: 2,
      collection_id: 10,
      name: 'Empty rows',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
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

    const draft = draftFromSaved(saved);
    expect(draft.headers).toEqual([emptyKeyValue()]);
    expect(draft.params).toEqual([emptyKeyValue()]);
  });
});
