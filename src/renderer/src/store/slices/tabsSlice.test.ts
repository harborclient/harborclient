import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { SavedRequest, ScriptTestResult, SendResult } from '#/shared/types';
import { asRequestTab, draftFromSaved, isPageTab, isTabDirty } from '#/renderer/src/store/drafts';
import tabsReducer, {
  activateNextTab,
  activatePreviousTab,
  closeTab,
  closeTabsForCollection,
  closeTabsForEnvironment,
  closeTabsForRequest,
  loadRequest,
  newTab,
  openPageTab,
  openTabWithDraft,
  reorderTabs
} from '#/renderer/src/store/slices/tabsSlice';

/**
 * Builds a saved request fixture for loadRequest tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Saved request suitable for reducer actions.
 */
function sampleSaved(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 1,
    uuid: '',
    collection_id: 10,
    folder_id: null,
    name: 'Get users',
    method: 'GET',
    url: 'https://example.com/users',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    params: [{ key: 'page', value: '1', enabled: true }],
    auth: defaultAuth(),
    body: '',
    body_type: 'none',
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
  };
}

describe('tabsSlice closeTab', () => {
  it('leaves zero tabs open when the only tab is closed', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const tabId = initial.activeTabId;

    const state = tabsReducer(initial, closeTab(tabId));

    expect(state.tabs).toEqual([]);
    expect(state.activeTabId).toBe('');
  });

  it('selects a neighbor when closing a non-active tab among multiple', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    const firstTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    const secondTabId = state.activeTabId;

    state = tabsReducer(state, closeTab(firstTabId));

    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.tabId).toBe(secondTabId);
    expect(state.activeTabId).toBe(secondTabId);
  });

  it('selects a neighbor when closing the active tab among multiple', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    const firstTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    const secondTabId = state.activeTabId;

    state = tabsReducer(state, closeTab(secondTabId));

    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.tabId).toBe(firstTabId);
    expect(state.activeTabId).toBe(firstTabId);
  });
});

describe('tabsSlice closeTabsForRequest', () => {
  it('leaves zero tabs open when all tabs match the request id', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(
      state,
      openTabWithDraft({
        id: 42,
        collection_id: 10,
        folder_id: null,
        name: 'Only tab',
        method: 'GET',
        url: 'https://example.com',
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
        tags: ''
      })
    );

    state = tabsReducer(state, closeTabsForRequest(42));

    expect(state.tabs).toEqual([]);
    expect(state.activeTabId).toBe('');
  });
});

describe('tabsSlice openPageTab', () => {
  it('opens a new page tab and selects it', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const state = tabsReducer(initial, openPageTab({ type: 'plugins' }));

    expect(state.tabs).toHaveLength(initial.tabs.length + 1);
    const pageTab = state.tabs[state.tabs.length - 1];
    expect(isPageTab(pageTab)).toBe(true);
    if (isPageTab(pageTab)) {
      expect(pageTab.page).toEqual({ type: 'plugins' });
    }
    expect(state.activeTabId).toBe(pageTab?.tabId);
  });

  it('focuses an existing page tab instead of opening a duplicate', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(state, openPageTab({ type: 'settings', section: 'general' }));
    const existingTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    state = tabsReducer(state, openPageTab({ type: 'settings', section: 'ai' }));

    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(existingTabId);
    const settingsTab = state.tabs.find((tab) => tab.tabId === existingTabId);
    expect(settingsTab).toBeDefined();
    expect(isPageTab(settingsTab!)).toBe(true);
    if (isPageTab(settingsTab!)) {
      expect(settingsTab.page).toEqual({ type: 'settings', section: 'ai' });
    }
  });
});

describe('tabsSlice closeTabsForCollection', () => {
  it('leaves zero tabs open when all tabs belong to the collection', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(
      state,
      openTabWithDraft({
        collection_id: 99,
        folder_id: null,
        name: 'Only tab',
        method: 'GET',
        url: 'https://example.com',
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
        tags: ''
      })
    );

    state = tabsReducer(state, closeTabsForCollection(99));

    expect(state.tabs).toEqual([]);
    expect(state.activeTabId).toBe('');
  });

  it('closes matching collection settings page tabs', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(state, openPageTab({ type: 'collection', id: 99 }));
    state = tabsReducer(state, newTab());

    state = tabsReducer(state, closeTabsForCollection(99));

    expect(state.tabs).toHaveLength(1);
    expect(isPageTab(state.tabs[0]!)).toBe(false);
  });
});

describe('tabsSlice closeTabsForEnvironment', () => {
  it('closes matching environment settings page tabs', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(state, openPageTab({ type: 'environment', id: 7 }));
    state = tabsReducer(state, newTab());

    state = tabsReducer(state, closeTabsForEnvironment(7));

    expect(state.tabs).toHaveLength(1);
    expect(isPageTab(state.tabs[0]!)).toBe(false);
  });
});

describe('tabsSlice loadRequest', () => {
  it('opens a new tab when no tab exists for the saved request id', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const req = sampleSaved();

    const state = tabsReducer(initial, loadRequest(req));

    expect(state.tabs).toHaveLength(initial.tabs.length + 1);
    expect(asRequestTab(state.tabs[state.tabs.length - 1]).draft).toEqual(draftFromSaved(req));
    expect(state.activeTabId).toBe(state.tabs[state.tabs.length - 1]?.tabId);
  });

  it('refreshes draft fields when reopening an existing saved request tab', () => {
    const initial = tabsReducer(
      undefined,
      openTabWithDraft({
        id: 1,
        collection_id: 10,
        folder_id: null,
        name: 'Stale name',
        method: 'GET',
        url: 'https://example.com/old',
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
        tags: ''
      })
    );
    const tabId = initial.activeTabId;
    const updated = sampleSaved({
      name: 'Get users',
      url: 'https://example.com/users',
      folder_id: 5,
      collection_id: 20
    });

    const state = tabsReducer(initial, loadRequest(updated));
    const tab = asRequestTab(state.tabs.find((t) => t.tabId === tabId));

    expect(state.activeTabId).toBe(tabId);
    expect(state.tabs).toHaveLength(initial.tabs.length);
    expect(tab.draft).toEqual(draftFromSaved(updated));
    expect(tab.savedDraft).toEqual(draftFromSaved(updated));
    expect(isTabDirty(tab)).toBe(false);
  });

  it('clears response and test results when reloading an existing tab', () => {
    const initial = tabsReducer(
      undefined,
      openTabWithDraft({
        id: 1,
        collection_id: 10,
        folder_id: null,
        name: 'Get users',
        method: 'GET',
        url: 'https://example.com/old',
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
        tags: ''
      })
    );
    const tabId = initial.activeTabId;
    const withSendState = {
      ...initial,
      tabs: initial.tabs.map((tab) =>
        tab.tabId === tabId
          ? {
              ...tab,
              response: { status: 200 } as SendResult,
              testResults: [{ name: 'ok', passed: true }] as ScriptTestResult[]
            }
          : tab
      )
    };

    const state = tabsReducer(withSendState, loadRequest(sampleSaved()));

    const tab = asRequestTab(state.tabs.find((t) => t.tabId === tabId));
    expect(tab.response).toBeNull();
    expect(tab.testResults).toEqual([]);
  });
});

describe('tabsSlice reorderTabs', () => {
  it('reorders open tabs without changing the active tab', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    const firstTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    const secondTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    const thirdTabId = state.activeTabId;

    state = tabsReducer(state, reorderTabs([firstTabId, thirdTabId, secondTabId]));

    expect(state.tabs.map((tab) => tab.tabId)).toEqual([firstTabId, thirdTabId, secondTabId]);
    expect(state.activeTabId).toBe(thirdTabId);
  });

  it('ignores invalid reorder payloads', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    const firstTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    const secondTabId = state.activeTabId;
    const originalOrder = state.tabs.map((tab) => tab.tabId);

    state = tabsReducer(state, reorderTabs([secondTabId]));
    expect(state.tabs.map((tab) => tab.tabId)).toEqual(originalOrder);

    state = tabsReducer(state, reorderTabs([secondTabId, firstTabId, 'missing-tab']));
    expect(state.tabs.map((tab) => tab.tabId)).toEqual(originalOrder);
  });
});

describe('tabsSlice tab cycling', () => {
  it('does not change active tab when zero or one tab is open', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    const singleTabId = state.activeTabId;

    state = tabsReducer(state, activateNextTab());
    expect(state.activeTabId).toBe(singleTabId);

    state = tabsReducer(state, activatePreviousTab());
    expect(state.activeTabId).toBe(singleTabId);

    state = tabsReducer(state, closeTab(singleTabId));
    expect(state.tabs).toHaveLength(0);

    state = tabsReducer(state, activateNextTab());
    expect(state.activeTabId).toBe('');
  });

  it('wraps forward and backward across multiple tabs', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    const firstTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    const secondTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    const thirdTabId = state.activeTabId;

    state = tabsReducer(state, activatePreviousTab());
    expect(state.activeTabId).toBe(secondTabId);

    state = tabsReducer(state, activatePreviousTab());
    expect(state.activeTabId).toBe(firstTabId);

    state = tabsReducer(state, activatePreviousTab());
    expect(state.activeTabId).toBe(thirdTabId);

    state = tabsReducer(state, activateNextTab());
    expect(state.activeTabId).toBe(firstTabId);
  });
});
