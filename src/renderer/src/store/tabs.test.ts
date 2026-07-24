import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { SavedRequest } from '#/shared/types';
import { createInlineScriptRef } from '#/shared/scriptRefs';
import {
  cloneDraft,
  createMarkdownTab,
  createTab,
  defaultDraft,
  draftFromSaved,
  emptyKeyValue,
  getDirtyTabs,
  getDirtyTabsInCollection,
  getDirtyTabsInFolder,
  isDraftDirty,
  isTabDirty,
  normalizeDraft,
  normalizeDraftForCompare,
  normalizeKeyValueRows,
  reconcileMarkdownTab,
  reconcileRequestTab,
  type RequestDraft,
  type RequestTab
} from './tabs';
import type { CollectionDocument } from '#/shared/types';

const sampleDraft = (): RequestDraft => ({
  name: 'Sample',
  method: 'POST',
  url: 'https://example.com',
  headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
  params: [{ key: 'page', value: '1', enabled: true }],
  auth: defaultAuth(),
  body: '{"ok":true}',
  body_type: 'json',
  body_raw: null,
  body_raw_open: false,
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: '',
  tags: ''
});

describe('normalizeKeyValueRows', () => {
  it('returns a blank row for null, undefined, and empty arrays', () => {
    expect(normalizeKeyValueRows(null)).toEqual([emptyKeyValue()]);
    expect(normalizeKeyValueRows(undefined)).toEqual([emptyKeyValue()]);
    expect(normalizeKeyValueRows([])).toEqual([emptyKeyValue()]);
  });

  it('coerces missing key and value fields to strings', () => {
    expect(
      normalizeKeyValueRows([
        { key: 'Authorization', value: 'Bearer token', enabled: true },
        {
          key: undefined as unknown as string,
          value: undefined as unknown as string,
          enabled: undefined as unknown as boolean
        }
      ])
    ).toEqual([
      { key: 'Authorization', value: 'Bearer token', enabled: true },
      { key: '', value: '', enabled: true }
    ]);
  });
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
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      auth: defaultAuth()
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

  it('does not mark dirty when only script expanded flags differ', () => {
    const base = normalizeDraft({
      ...sampleDraft(),
      pre_request_scripts: [createInlineScriptRef('console.log("test");')],
      post_request_scripts: [createInlineScriptRef('after();')]
    });

    const draft = cloneDraft(base);
    draft.pre_request_scripts = draft.pre_request_scripts.map((script) => ({
      ...script,
      expanded: true
    }));
    draft.post_request_scripts = draft.post_request_scripts.map((script) => ({
      ...script,
      expanded: false
    }));

    const saved = cloneDraft(base);
    saved.pre_request_scripts = saved.pre_request_scripts.map((script) => ({
      ...script,
      expanded: false
    }));
    saved.post_request_scripts = saved.post_request_scripts.map((script) => ({
      ...script,
      expanded: true
    }));

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

/**
 * Builds a collection document fixture for reconcileMarkdownTab tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Saved document suitable for reconcile helpers.
 */
function sampleDocument(overrides: Partial<CollectionDocument> = {}): CollectionDocument {
  return {
    id: 1,
    uuid: 'doc-uuid',
    collection_id: 10,
    folder_id: null,
    name: 'README.md',
    content: '# Hello',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('reconcileMarkdownTab', () => {
  it('clears editor drift when disk matches the saved baseline', () => {
    const doc = sampleDocument({ content: '# Hello' });
    const tab = createMarkdownTab(doc);
    tab.content = '# Hello\n';

    const reconciled = reconcileMarkdownTab(tab, doc);
    expect(reconciled).toEqual({
      content: '# Hello',
      savedContent: '# Hello',
      name: 'README.md',
      folderId: null
    });
  });

  it('updates a missed saved baseline when disk matches editor content', () => {
    const doc = sampleDocument({ content: '# Saved on disk' });
    const tab = createMarkdownTab(sampleDocument({ content: '# Old baseline' }));
    tab.content = '# Saved on disk';
    tab.savedContent = '# Old baseline';

    const reconciled = reconcileMarkdownTab(tab, doc);
    expect(reconciled).toEqual({
      content: '# Saved on disk',
      savedContent: '# Saved on disk',
      name: 'README.md',
      folderId: null
    });
  });

  it('pulls external disk changes into a clean tab', () => {
    const tab = createMarkdownTab(sampleDocument({ content: '# Local' }));
    const doc = sampleDocument({ content: '# From pull', name: 'NOTES.md', folder_id: 3 });

    const reconciled = reconcileMarkdownTab(tab, doc);
    expect(reconciled).toEqual({
      content: '# From pull',
      savedContent: '# From pull',
      name: 'NOTES.md',
      folderId: 3
    });
  });

  it('preserves real local edits when disk differs from both content and saved baseline', () => {
    const tab = createMarkdownTab(sampleDocument({ content: '# Baseline' }));
    tab.content = '# My local edit';
    const doc = sampleDocument({ content: '# Someone else changed disk' });

    expect(reconcileMarkdownTab(tab, doc)).toBeNull();
  });
});

describe('reconcileRequestTab', () => {
  const sampleSaved = (overrides: Partial<SavedRequest> = {}): SavedRequest => ({
    id: 42,
    uuid: '',
    collection_id: 10,
    folder_id: null,
    name: 'Get users',
    method: 'GET',
    url: 'https://example.com/users',
    headers: [],
    params: [],
    auth: defaultAuth(),
    body: '',
    body_type: 'none',
    body_raw: null,
    body_raw_open: false,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  });

  it('pulls external disk changes into a clean tab', () => {
    const tab = createTab(draftFromSaved(sampleSaved({ url: 'https://example.com/old' })));
    tab.draft.id = 42;
    tab.draft.collection_id = 10;
    tab.savedDraft = cloneDraft(tab.draft);

    const reconciled = reconcileRequestTab(tab, sampleSaved({ url: 'https://example.com/new' }));
    expect(reconciled?.draft.url).toBe('https://example.com/new');
    expect(reconciled?.savedDraft.url).toBe('https://example.com/new');
    expect(reconciled?.response).toBeNull();
  });

  it('preserves real local edits when the tab is dirty', () => {
    const tab = createTab(draftFromSaved(sampleSaved()));
    tab.draft.id = 42;
    tab.draft.collection_id = 10;
    tab.savedDraft = cloneDraft(tab.draft);
    tab.draft.url = 'https://example.com/edited';

    expect(
      reconcileRequestTab(tab, sampleSaved({ url: 'https://example.com/external' }))
    ).toBeNull();
  });

  it('returns null when disk already matches the open tab', () => {
    const tab = createTab(draftFromSaved(sampleSaved()));
    tab.draft.id = 42;
    tab.draft.collection_id = 10;
    tab.savedDraft = cloneDraft(tab.draft);

    expect(reconcileRequestTab(tab, sampleSaved())).toBeNull();
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

describe('getDirtyTabsInCollection', () => {
  it('returns dirty tabs scoped to the collection', () => {
    const dirtyInCollection = createTab({ ...sampleDraft(), collection_id: 1, id: 10 });
    dirtyInCollection.draft.url = 'https://changed.example';
    const dirtyOtherCollection = createTab({ ...sampleDraft(), collection_id: 2, id: 20 });
    dirtyOtherCollection.draft.url = 'https://other.example';
    const cleanInCollection = createTab({ ...sampleDraft(), collection_id: 1, id: 11 });

    expect(
      getDirtyTabsInCollection([dirtyInCollection, dirtyOtherCollection, cleanInCollection], 1)
    ).toEqual([dirtyInCollection]);
  });
});

describe('getDirtyTabsInFolder', () => {
  it('returns dirty tabs scoped to the folder', () => {
    const dirtyInFolder = createTab({
      ...sampleDraft(),
      collection_id: 1,
      folder_id: 5,
      id: 10
    });
    dirtyInFolder.draft.url = 'https://folder.example';
    const dirtyRoot = createTab({ ...sampleDraft(), collection_id: 1, folder_id: null, id: 11 });
    dirtyRoot.draft.url = 'https://root.example';
    const dirtyOtherFolder = createTab({
      ...sampleDraft(),
      collection_id: 1,
      folder_id: 6,
      id: 12
    });
    dirtyOtherFolder.draft.url = 'https://other-folder.example';

    expect(getDirtyTabsInFolder([dirtyInFolder, dirtyRoot, dirtyOtherFolder], 1, 5)).toEqual([
      dirtyInFolder
    ]);
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
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
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
      uuid: '',
      collection_id: 10,
      name: 'Saved',
      method: 'PUT',
      url: 'https://api.example.com',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      params: [{ key: 'q', value: 'search', enabled: true }],
      auth: defaultAuth(),
      body: 'body',
      body_type: 'text',
      body_raw: null,
      body_raw_open: false,
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

    expect(draftFromSaved(saved)).toEqual({
      id: 1,
      collection_id: 10,
      folder_id: null,
      name: 'Saved',
      method: 'PUT',
      url: 'https://api.example.com?q=search',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      params: [{ key: 'q', value: 'search', enabled: true }],
      auth: defaultAuth(),
      body: 'body',
      body_type: 'text',
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
    });
  });

  it('leaves disabled params out of the synced URL', () => {
    const saved: SavedRequest = {
      id: 3,
      uuid: '',
      collection_id: 10,
      name: 'Disabled param',
      method: 'GET',
      url: 'https://example.com',
      headers: [],
      params: [
        { key: 'active', value: 'yes', enabled: true },
        { key: 'inactive', value: 'no', enabled: false }
      ],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
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

    expect(draftFromSaved(saved).url).toBe('https://example.com?active=yes');
  });

  it('inserts query before a hash fragment', () => {
    const saved: SavedRequest = {
      id: 4,
      uuid: '',
      collection_id: 10,
      name: 'Hash URL',
      method: 'GET',
      url: 'https://example.com/path#frag',
      headers: [],
      params: [{ key: 'q', value: '1', enabled: true }],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
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

    expect(draftFromSaved(saved).url).toBe('https://example.com/path?q=1#frag');
  });

  it('is idempotent when the URL already contains the same query string', () => {
    const saved: SavedRequest = {
      id: 5,
      uuid: '',
      collection_id: 10,
      name: 'Already synced',
      method: 'GET',
      url: 'https://example.com?foo=bar',
      headers: [],
      params: [{ key: 'foo', value: 'bar', enabled: true }],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
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

    expect(draftFromSaved(saved).url).toBe('https://example.com?foo=bar');
  });

  it('backfills empty headers and params with a blank row', () => {
    const saved: SavedRequest = {
      id: 2,
      uuid: '',
      collection_id: 10,
      name: 'Empty rows',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
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

    const draft = draftFromSaved(saved);
    expect(draft.headers).toEqual([emptyKeyValue()]);
    expect(draft.params).toEqual([emptyKeyValue()]);
  });
});
