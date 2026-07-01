import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { RequestDraft } from '#/renderer/src/store/drafts';
import { asRequestTab, createTab, isRequestTab, isTabDirty } from '#/renderer/src/store/drafts';
import {
  defaultTabState,
  LEGACY_OPEN_TABS_KEY,
  loadTabsFromStorage,
  markTabsHydrated,
  OPEN_TABS_KEY,
  parseOpenTabsFromRaw,
  persistActiveEnvironmentId,
  persistTabs,
  resetInitialTabStateForTests,
  resetTabsHydratedForTests,
  type PersistedOpenTabs
} from '#/renderer/src/store/persistence';

const sampleDraft = (overrides: Partial<RequestDraft> = {}): RequestDraft => ({
  name: 'Sample',
  method: 'GET',
  url: 'https://example.com',
  headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
  params: [{ key: 'page', value: '1', enabled: true }],
  body: '',
  body_type: 'none',
  pre_request_script: '',
  post_request_script: '',
  comment: '',
  auth: defaultAuth(),
  ...overrides
});

const persistedPayload = (overrides: Partial<PersistedOpenTabs> = {}): PersistedOpenTabs => {
  const tabId = overrides.tabs?.[0]?.tabId ?? 'tab-1';
  const firstTab = overrides.tabs?.[0];
  const draft = firstTab && 'draft' in firstTab ? firstTab.draft : sampleDraft();
  return {
    tabs: [{ tabId, draft }],
    activeTabId: tabId,
    ...overrides
  };
};

/**
 * Minimal window stub for persistence tests that call electron-store IPC helpers.
 */
function createWindowApiMock(
  handlers: Partial<{
    getOpenTabsPayload: () => Promise<string | null>;
    setOpenTabsPayload: (payload: string) => Promise<void>;
  }> = {}
): Window & typeof globalThis {
  return {
    location: { origin: 'http://test' },
    api: {
      setOpenTabsPayload: vi.fn(async () => undefined),
      ...handlers
    }
  } as unknown as Window & typeof globalThis;
}

/**
 * Minimal localStorage mock backed by an in-memory map for persistence tests.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
}

describe('loadTabsFromStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores a valid persisted payload', () => {
    const payload = persistedPayload({
      tabs: [
        { tabId: 'tab-a', draft: sampleDraft({ name: 'First' }) },
        { tabId: 'tab-b', draft: sampleDraft({ name: 'Second' }) }
      ],
      activeTabId: 'tab-b'
    });
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(2);
    expect(result.tabs[0].tabId).toBe('tab-a');
    expect(asRequestTab(result.tabs[0]).draft.name).toBe('First');
    expect(asRequestTab(result.tabs[0]).draft.url).toBe('https://example.com?page=1');
    expect(result.tabs[1].tabId).toBe('tab-b');
    expect(result.activeTabId).toBe('tab-b');
    expect(asRequestTab(result.tabs[0]).response).toBeNull();
    expect(asRequestTab(result.tabs[0]).sending).toBe(false);
  });

  it('returns a default tab when JSON is corrupt', () => {
    localStorage.setItem(OPEN_TABS_KEY, '{not-json');

    const result = loadTabsFromStorage();
    const fallback = defaultTabState();

    expect(result.tabs).toHaveLength(1);
    expect(result.activeTabId).toBe(result.tabs[0].tabId);
    expect(asRequestTab(result.tabs[0]).draft.name).toBe(asRequestTab(fallback.tabs[0]).draft.name);
  });

  it('restores an intentionally empty tabs payload', () => {
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify({ tabs: [], activeTabId: '' }));

    const result = loadTabsFromStorage();

    expect(result.tabs).toEqual([]);
    expect(result.activeTabId).toBe('');
  });

  it('returns a default tab when every tab entry fails salvage', () => {
    localStorage.setItem(
      OPEN_TABS_KEY,
      JSON.stringify({
        tabs: [{ tabId: 'missing-draft' }, { tabId: 'bad-headers', draft: { name: 'Bad' } }],
        activeTabId: 'missing-draft'
      })
    );

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(result.activeTabId).toBe(result.tabs[0].tabId);
  });

  it('returns a default tab when the top-level shape is invalid', () => {
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(null));
    expect(loadTabsFromStorage().tabs).toHaveLength(1);

    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify({ activeTabId: 'tab-1' }));
    expect(loadTabsFromStorage().tabs).toHaveLength(1);

    localStorage.setItem(
      OPEN_TABS_KEY,
      JSON.stringify({ tabs: 'not-an-array', activeTabId: 'tab-1' })
    );
    expect(loadTabsFromStorage().tabs).toHaveLength(1);
  });

  it('salvages valid tabs and skips malformed entries', () => {
    const payload = {
      tabs: [
        { tabId: 'good-tab', draft: sampleDraft({ name: 'Good' }) },
        { tabId: 'missing-draft' },
        { tabId: 'bad-headers', draft: { ...sampleDraft(), headers: 'not-an-array' } }
      ],
      activeTabId: 'good-tab'
    };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].tabId).toBe('good-tab');
    expect(asRequestTab(result.tabs[0]).draft.name).toBe('Good');
    expect(result.activeTabId).toBe('good-tab');
  });

  it('falls back to the first salvaged tab when activeTabId is invalid', () => {
    const payload = persistedPayload({
      tabs: [
        { tabId: 'tab-a', draft: sampleDraft({ name: 'First' }) },
        { tabId: 'tab-b', draft: sampleDraft({ name: 'Second' }) }
      ],
      activeTabId: 'missing-tab'
    });
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(2);
    expect(result.activeTabId).toBe('tab-a');
  });

  it('restores legacy drafts missing script fields via normalizeDraft', () => {
    const legacyDraft = {
      name: 'Legacy',
      method: 'GET',
      url: 'https://legacy.example',
      headers: [{ key: 'X-Test', value: '1', enabled: true }],
      params: [{ key: 'q', value: 'search', enabled: true }],
      body: '',
      body_type: 'none'
    };
    const payload = {
      tabs: [{ tabId: 'legacy-tab', draft: legacyDraft }],
      activeTabId: 'legacy-tab'
    };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(asRequestTab(result.tabs[0]).draft).toMatchObject({
      name: 'Legacy',
      url: 'https://legacy.example?q=search',
      pre_request_script: '',
      post_request_script: '',
      comment: ''
    });
    expect(isTabDirty(result.tabs[0])).toBe(false);
  });

  it('reads from the legacy storage key and migrates to the current key', () => {
    const payload = persistedPayload({
      tabs: [{ tabId: 'legacy-tab', draft: sampleDraft({ name: 'Legacy key' }) }],
      activeTabId: 'legacy-tab'
    });
    localStorage.setItem(LEGACY_OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(asRequestTab(result.tabs[0]).draft.name).toBe('Legacy key');
    expect(localStorage.getItem(OPEN_TABS_KEY)).toBe(JSON.stringify(payload));
  });

  it('skips duplicate tabIds and keeps the first occurrence', () => {
    const payload = {
      tabs: [
        { tabId: 'dup-tab', draft: sampleDraft({ name: 'First' }) },
        { tabId: 'dup-tab', draft: sampleDraft({ name: 'Duplicate' }) }
      ],
      activeTabId: 'dup-tab'
    };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(asRequestTab(result.tabs[0]).draft.name).toBe('First');
  });

  it('restores drafts with auth and round-trips through persistTabs', () => {
    vi.stubGlobal('window', createWindowApiMock());
    markTabsHydrated();
    const tab = createTab(
      sampleDraft({
        name: 'Authed',
        auth: {
          ...defaultAuth(),
          type: 'bearer',
          bearer: { token: 'secret' }
        }
      })
    );
    persistTabs([tab], tab.tabId);

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(asRequestTab(result.tabs[0]).draft.name).toBe('Authed');
    expect(asRequestTab(result.tabs[0]).draft.auth.type).toBe('bearer');
    expect(asRequestTab(result.tabs[0]).draft.auth.bearer.token).toBe('secret');
  });

  it('restores legacy key-value rows missing enabled', () => {
    const payload = {
      tabs: [
        {
          tabId: 'legacy-kv',
          draft: {
            name: 'Legacy KV',
            method: 'GET',
            url: 'https://example.com',
            headers: [{ key: 'X-Test', value: '1' }],
            params: [{ key: 'page', value: '2' }],
            body: '',
            body_type: 'none'
          }
        }
      ],
      activeTabId: 'legacy-kv'
    };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(asRequestTab(result.tabs[0]).draft.headers[0]).toEqual({
      key: 'X-Test',
      value: '1',
      enabled: true
    });
    expect(asRequestTab(result.tabs[0]).draft.params[0]).toEqual({
      key: 'page',
      value: '2',
      enabled: true
    });
  });

  it('salvages draft when savedDraft is invalid', () => {
    const validDraft = sampleDraft({ name: 'Valid draft' });
    const payload = {
      tabs: [
        {
          tabId: 'salvaged-tab',
          draft: validDraft,
          savedDraft: { ...validDraft, headers: 'not-an-array' }
        }
      ],
      activeTabId: 'salvaged-tab'
    };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));

    const result = loadTabsFromStorage();

    expect(result.tabs).toHaveLength(1);
    expect(asRequestTab(result.tabs[0]).draft.name).toBe('Valid draft');
    expect(isTabDirty(result.tabs[0])).toBe(false);
  });
});

describe('persistTabs', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubGlobal('window', createWindowApiMock());
    markTabsHydrated();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetTabsHydratedForTests();
  });

  it('does not persist before hydration completes', () => {
    resetTabsHydratedForTests();
    const tab = createTab(sampleDraft({ name: 'Pre-hydrate' }));

    persistTabs([tab], tab.tabId);

    expect(localStorage.getItem(OPEN_TABS_KEY)).toBeNull();
  });

  it('does not throw when localStorage.setItem fails', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const tab = createTab();

    expect(() => persistTabs([tab], tab.tabId)).not.toThrow();
  });

  it('round-trips an empty tabs payload', () => {
    persistTabs([], '');

    const raw = localStorage.getItem(OPEN_TABS_KEY);
    expect(raw).not.toBeNull();

    const restored = parseOpenTabsFromRaw(raw!);
    expect(restored.tabs).toEqual([]);
    expect(restored.activeTabId).toBe('');
  });

  it('does not clobber a multi-tab payload when persisting the default single tab', () => {
    const multiTabPayload = persistedPayload({
      tabs: [
        { tabId: 'tab-a', draft: sampleDraft({ name: 'First' }) },
        { tabId: 'tab-b', draft: sampleDraft({ name: 'Second' }) }
      ],
      activeTabId: 'tab-b'
    });
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(multiTabPayload));

    const fallback = defaultTabState();
    persistTabs(fallback.tabs, fallback.activeTabId);

    expect(localStorage.getItem(OPEN_TABS_KEY)).toBe(JSON.stringify(multiTabPayload));
  });
});

describe('redux open-tab round trip', () => {
  let storedPayload: string | null = null;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    storedPayload = null;
    vi.stubGlobal(
      'window',
      createWindowApiMock({
        getOpenTabsPayload: vi.fn(async () => storedPayload),
        setOpenTabsPayload: vi.fn(async (payload: string) => {
          storedPayload = payload;
        })
      })
    );
    resetInitialTabStateForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetInitialTabStateForTests();
  });

  it('persists multiple open tabs and reloads them on simulated restart', async () => {
    vi.resetModules();
    const { markTabsHydrated } = await import('#/renderer/src/store/persistence');
    const { store } = await import('#/renderer/src/store/redux');
    const { openTabWithDraft } = await import('#/renderer/src/store/slices/tabsSlice');

    markTabsHydrated();
    store.dispatch(openTabWithDraft(sampleDraft({ name: 'First tab', id: 1, collection_id: 10 })));
    store.dispatch(openTabWithDraft(sampleDraft({ name: 'Second tab', id: 2, collection_id: 10 })));

    expect(storedPayload).not.toBeNull();
    expect(localStorage.getItem(OPEN_TABS_KEY)).toBe(storedPayload);

    resetInitialTabStateForTests();
    const restored = parseOpenTabsFromRaw(storedPayload!);

    const names = restored.tabs.filter(isRequestTab).map((tab) => tab.draft.name);
    expect(names).toContain('First tab');
    expect(names).toContain('Second tab');
  });

  it('round-trips page tabs through parseOpenTabsFromRaw', () => {
    const payload = JSON.stringify({
      tabs: [
        {
          tabId: 'page-tab-1',
          kind: 'page',
          page: { type: 'plugins' }
        }
      ],
      activeTabId: 'page-tab-1'
    });

    const restored = parseOpenTabsFromRaw(payload);

    expect(restored.tabs).toHaveLength(1);
    expect(restored.activeTabId).toBe('page-tab-1');
    const tab = restored.tabs[0];
    expect(tab?.tabId).toBe('page-tab-1');
    expect('kind' in tab! && tab.kind === 'page' && tab.page.type).toBe('plugins');
  });
});

describe('persistActiveEnvironmentId', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not throw when localStorage.setItem fails', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => persistActiveEnvironmentId(1)).not.toThrow();
  });

  it('does not throw when localStorage.removeItem fails', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(() => persistActiveEnvironmentId(null)).not.toThrow();
  });
});
