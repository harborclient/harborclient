import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { RequestDraft } from '#/renderer/src/store/drafts';
import { createTab, isTabDirty } from '#/renderer/src/store/drafts';
import {
  defaultTabState,
  LEGACY_OPEN_TABS_KEY,
  loadTabsFromStorage,
  OPEN_TABS_KEY,
  persistActiveEnvironmentId,
  persistTabs,
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
  const draft = overrides.tabs?.[0]?.draft ?? sampleDraft();
  return {
    tabs: [{ tabId, draft }],
    activeTabId: tabId,
    ...overrides
  };
};

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
    expect(result.tabs[0].draft.name).toBe('First');
    expect(result.tabs[0].draft.url).toBe('https://example.com?page=1');
    expect(result.tabs[1].tabId).toBe('tab-b');
    expect(result.activeTabId).toBe('tab-b');
    expect(result.tabs[0].response).toBeNull();
    expect(result.tabs[0].sending).toBe(false);
  });

  it('returns a default tab when JSON is corrupt', () => {
    localStorage.setItem(OPEN_TABS_KEY, '{not-json');

    const result = loadTabsFromStorage();
    const fallback = defaultTabState();

    expect(result.tabs).toHaveLength(1);
    expect(result.activeTabId).toBe(result.tabs[0].tabId);
    expect(result.tabs[0].draft.name).toBe(fallback.tabs[0].draft.name);
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
    expect(result.tabs[0].draft.name).toBe('Good');
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
    expect(result.tabs[0].draft).toMatchObject({
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
    expect(result.tabs[0].draft.name).toBe('Legacy key');
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
    expect(result.tabs[0].draft.name).toBe('First');
  });
});

describe('persistTabs', () => {
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
    const tab = createTab();

    expect(() => persistTabs([tab], tab.tabId)).not.toThrow();
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
