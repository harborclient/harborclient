import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type {
  CollectionDocument,
  SavedRequest,
  ScriptTestResult,
  SendResult
} from '#/shared/types';
import {
  asRequestTab,
  draftFromSaved,
  isPageTab,
  isRequestTab,
  isTabDirty,
  isMarkdownTab
} from '#/renderer/src/store/tabs';
import tabsReducer, {
  activateNextTab,
  activatePreviousTab,
  closeTab,
  closeTabsForCollection,
  closeTabsForEnvironment,
  closeAllRequestAndMarkdownTabs,
  closeRequestAndMarkdownTabsForCollection,
  closeTabsForRequest,
  loadDocument,
  loadRequest,
  newTab,
  openMarkdownTab,
  openPageTab,
  openTabWithDraft,
  reconcileMarkdownTabsFromDocuments,
  reconcileRequestTabsFromRequests,
  reorderTabs,
  setActiveDraft,
  setActiveTab,
  updateMarkdownContent
} from './tabsSlice';

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

  it('opens a themes page tab', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const state = tabsReducer(initial, openPageTab({ type: 'themes' }));

    const pageTab = state.tabs[state.tabs.length - 1];
    expect(isPageTab(pageTab)).toBe(true);
    if (isPageTab(pageTab)) {
      expect(pageTab.page).toEqual({ type: 'themes' });
    }
  });

  it('opens a cookies page tab', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const state = tabsReducer(initial, openPageTab({ type: 'cookies' }));

    const pageTab = state.tabs[state.tabs.length - 1];
    expect(isPageTab(pageTab)).toBe(true);
    if (isPageTab(pageTab)) {
      expect(pageTab.page).toEqual({ type: 'cookies' });
    }
  });

  it('opens a snippets page tab', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const state = tabsReducer(initial, openPageTab({ type: 'snippets' }));

    const pageTab = state.tabs[state.tabs.length - 1];
    expect(isPageTab(pageTab)).toBe(true);
    if (isPageTab(pageTab)) {
      expect(pageTab.page).toEqual({ type: 'snippets' });
    }
  });

  it('opens a getting-started page tab', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const state = tabsReducer(initial, openPageTab({ type: 'getting-started' }));

    const pageTab = state.tabs[state.tabs.length - 1];
    expect(isPageTab(pageTab)).toBe(true);
    if (isPageTab(pageTab)) {
      expect(pageTab.page).toEqual({ type: 'getting-started' });
    }
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

  it('updates focusVariableKey on an existing collection settings tab', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(
      state,
      openPageTab({ type: 'collection', id: 99, focusVariableKey: 'first' })
    );
    const existingTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    state = tabsReducer(
      state,
      openPageTab({ type: 'collection', id: 99, focusVariableKey: 'second' })
    );

    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(existingTabId);
    const collectionTab = state.tabs.find((tab) => tab.tabId === existingTabId);
    expect(collectionTab).toBeDefined();
    expect(isPageTab(collectionTab!)).toBe(true);
    if (isPageTab(collectionTab!)) {
      expect(collectionTab.page).toEqual({
        type: 'collection',
        id: 99,
        focusVariableKey: 'second'
      });
    }
  });

  it('updates focusSection on an existing collection settings tab', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(state, openPageTab({ type: 'collection', id: 42 }));
    const existingTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    state = tabsReducer(state, openPageTab({ type: 'collection', id: 42, focusSection: 'git' }));

    expect(state.activeTabId).toBe(existingTabId);
    const collectionTab = state.tabs.find((tab) => tab.tabId === existingTabId);
    expect(collectionTab).toBeDefined();
    expect(isPageTab(collectionTab!)).toBe(true);
    if (isPageTab(collectionTab!)) {
      expect(collectionTab.page).toEqual({
        type: 'collection',
        id: 42,
        focusSection: 'git'
      });
    }
  });

  it('updates focusVariableKey on an existing environment settings tab', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(
      state,
      openPageTab({ type: 'environment', id: 7, focusVariableKey: 'first' })
    );
    const existingTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    state = tabsReducer(
      state,
      openPageTab({ type: 'environment', id: 7, focusVariableKey: 'second' })
    );

    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(existingTabId);
    const environmentTab = state.tabs.find((tab) => tab.tabId === existingTabId);
    expect(environmentTab).toBeDefined();
    expect(isPageTab(environmentTab!)).toBe(true);
    if (isPageTab(environmentTab!)) {
      expect(environmentTab.page).toEqual({
        type: 'environment',
        id: 7,
        focusVariableKey: 'second'
      });
    }
  });

  it('retargets an existing collection runner tab instead of opening a duplicate', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(
      state,
      openPageTab({ type: 'collection-runner', collectionId: 1, requestId: 10 })
    );
    const existingTabId = state.activeTabId;
    state = tabsReducer(state, newTab());
    state = tabsReducer(
      state,
      openPageTab({ type: 'collection-runner', collectionId: 2, folderId: 5 })
    );

    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(existingTabId);
    const runnerTab = state.tabs.find((tab) => tab.tabId === existingTabId);
    expect(runnerTab).toBeDefined();
    expect(isPageTab(runnerTab!)).toBe(true);
    if (isPageTab(runnerTab!)) {
      expect(runnerTab.page).toEqual({
        type: 'collection-runner',
        collectionId: 2,
        folderId: 5
      });
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

  it('closes matching collection runner page tabs', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(
      state,
      openPageTab({ type: 'collection-runner', collectionId: 99, requestId: 5 })
    );
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

describe('tabsSlice closeAllRequestAndMarkdownTabs', () => {
  it('closes every request and markdown tab but leaves page tabs open', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(state, loadRequest({ req: sampleSaved({ id: 11, collection_id: 1 }) }));
    state = tabsReducer(
      state,
      loadDocument({ doc: sampleDocument({ id: 22, collection_id: 2 }), activate: false })
    );
    state = tabsReducer(state, openPageTab({ type: 'plugins' }));

    state = tabsReducer(state, closeAllRequestAndMarkdownTabs());

    expect(state.tabs).toHaveLength(1);
    expect(isPageTab(state.tabs[0]!)).toBe(true);
    if (isPageTab(state.tabs[0]!)) {
      expect(state.tabs[0].page.type).toBe('plugins');
    }
  });
});

describe('tabsSlice closeRequestAndMarkdownTabsForCollection', () => {
  it('closes only request and markdown tabs for the target collection', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, closeTab(state.activeTabId));
    state = tabsReducer(
      state,
      loadRequest({ req: sampleSaved({ id: 11, collection_id: 1 }), activate: false })
    );
    state = tabsReducer(
      state,
      loadRequest({ req: sampleSaved({ id: 12, collection_id: 2 }), activate: false })
    );
    state = tabsReducer(
      state,
      loadDocument({ doc: sampleDocument({ id: 21, collection_id: 1 }), activate: false })
    );
    state = tabsReducer(state, openPageTab({ type: 'collection', id: 1 }));

    state = tabsReducer(state, closeRequestAndMarkdownTabsForCollection(1));

    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.some((tab) => isRequestTab(tab) && tab.draft.id === 12)).toBe(true);
    expect(isPageTab(state.tabs.find((tab) => isPageTab(tab))!)).toBe(true);
    expect(state.tabs.some((tab) => isMarkdownTab(tab))).toBe(false);
    expect(state.tabs.some((tab) => isRequestTab(tab) && tab.draft.id === 11)).toBe(false);
  });
});

describe('tabsSlice loadRequest', () => {
  it('opens a new tab when no tab exists for the saved request id', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const req = sampleSaved();

    const state = tabsReducer(initial, loadRequest({ req }));

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

    const state = tabsReducer(initial, loadRequest({ req: updated }));
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
              testResults: [{ name: 'ok', passed: true }] as ScriptTestResult[],
              scriptLogs: ['hello'],
              scriptError: 'boom'
            }
          : tab
      )
    };

    const state = tabsReducer(withSendState, loadRequest({ req: sampleSaved() }));

    const tab = asRequestTab(state.tabs.find((t) => t.tabId === tabId));
    expect(tab.response).toBeNull();
    expect(tab.testResults).toEqual([]);
    expect(tab.scriptLogs).toEqual([]);
    expect(tab.executionEvents).toEqual([]);
    expect(tab.scriptError).toBeUndefined();
  });

  it('does not change activeTabId when loading a new request with activate false', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, openPageTab({ type: 'collection-runner', collectionId: 1 }));
    const runnerTabId = state.activeTabId;

    const req = sampleSaved({ id: 55 });
    state = tabsReducer(state, loadRequest({ req, activate: false }));

    expect(state.activeTabId).toBe(runnerTabId);
    expect(state.tabs.some((tab) => isRequestTab(tab) && tab.draft.id === 55)).toBe(true);
  });

  it('does not change activeTabId when reloading an existing request with activate false', () => {
    let state = tabsReducer(undefined, { type: 'unknown' });
    state = tabsReducer(state, openPageTab({ type: 'collection-runner', collectionId: 1 }));
    const runnerTabId = state.activeTabId;
    const req = sampleSaved({ id: 56, url: 'https://example.com/v1' });

    state = tabsReducer(state, loadRequest({ req }));
    state = tabsReducer(state, setActiveTab(runnerTabId));
    state = tabsReducer(
      state,
      loadRequest({
        req: sampleSaved({ id: 56, url: 'https://example.com/v2', params: [] }),
        activate: false
      })
    );

    expect(state.activeTabId).toBe(runnerTabId);
    const requestTab = state.tabs.find((tab) => isRequestTab(tab) && tab.draft.id === 56);
    expect(requestTab).toBeDefined();
    expect(asRequestTab(requestTab).draft.url).toBe('https://example.com/v2');
  });

  it('activates a dirty existing tab without overwriting its draft', () => {
    let state = tabsReducer(
      undefined,
      openTabWithDraft({
        id: 57,
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
    const tabId = state.activeTabId;
    const dirtyDraft = {
      ...asRequestTab(state.tabs.find((tab) => tab.tabId === tabId)).draft,
      url: 'https://example.com/edited'
    };
    state = tabsReducer(state, setActiveDraft(dirtyDraft));
    state = tabsReducer(state, openPageTab({ type: 'collection-runner', collectionId: 1 }));

    state = tabsReducer(
      state,
      loadRequest({
        req: sampleSaved({ id: 57, url: 'https://example.com/users' })
      })
    );

    expect(state.activeTabId).toBe(tabId);
    expect(asRequestTab(state.tabs.find((tab) => tab.tabId === tabId)).draft.url).toBe(
      'https://example.com/edited'
    );
    expect(isTabDirty(asRequestTab(state.tabs.find((tab) => tab.tabId === tabId)))).toBe(true);
  });
});

/**
 * Builds a saved markdown document fixture for loadDocument tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Saved document suitable for reducer actions.
 */
function sampleDocument(overrides: Partial<CollectionDocument> = {}): CollectionDocument {
  return {
    id: 1,
    uuid: 'doc-uuid',
    collection_id: 10,
    folder_id: null,
    name: 'README',
    content: '# Hello',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('tabsSlice loadDocument', () => {
  it('activates a dirty existing tab without overwriting its content', () => {
    const doc = sampleDocument();
    let state = tabsReducer(undefined, openMarkdownTab({ doc }));
    const tabId = state.activeTabId;
    state = tabsReducer(state, updateMarkdownContent({ tabId, content: '# Edited locally' }));
    state = tabsReducer(state, openPageTab({ type: 'collection-runner', collectionId: 1 }));

    state = tabsReducer(
      state,
      loadDocument({
        doc: sampleDocument({ content: '# From disk' })
      })
    );

    const tab = state.tabs.find((entry) => entry.tabId === tabId);
    expect(tab).toBeDefined();
    if (!tab || !isMarkdownTab(tab)) {
      throw new Error('expected markdown tab');
    }
    expect(state.activeTabId).toBe(tabId);
    expect(tab.content).toBe('# Edited locally');
    expect(isTabDirty(tab)).toBe(true);
  });

  it('clears false dirty when disk content matches the saved baseline', () => {
    const doc = sampleDocument({ content: '# Hello' });
    let state = tabsReducer(undefined, openMarkdownTab({ doc }));
    const tabId = state.activeTabId;
    state = tabsReducer(state, updateMarkdownContent({ tabId, content: '# Hello\n' }));

    state = tabsReducer(
      state,
      loadDocument({
        doc: sampleDocument({ content: '# Hello' })
      })
    );

    const tab = state.tabs.find((entry) => entry.tabId === tabId);
    expect(tab).toBeDefined();
    if (!tab || !isMarkdownTab(tab)) {
      throw new Error('expected markdown tab');
    }
    expect(tab.content).toBe('# Hello');
    expect(tab.savedContent).toBe('# Hello');
    expect(isTabDirty(tab)).toBe(false);
  });
});

describe('tabsSlice reconcileMarkdownTabsFromDocuments', () => {
  it('clears editor drift for open markdown tabs in the collection', () => {
    const doc = sampleDocument({ content: '# Hello' });
    let state = tabsReducer(undefined, openMarkdownTab({ doc }));
    const tabId = state.activeTabId;
    state = tabsReducer(state, updateMarkdownContent({ tabId, content: '# Hello\n' }));

    state = tabsReducer(
      state,
      reconcileMarkdownTabsFromDocuments({
        collectionId: 10,
        documents: [sampleDocument({ content: '# Hello' })]
      })
    );

    const tab = state.tabs.find((entry) => entry.tabId === tabId);
    expect(tab).toBeDefined();
    if (!tab || !isMarkdownTab(tab)) {
      throw new Error('expected markdown tab');
    }
    expect(tab.content).toBe('# Hello');
    expect(isTabDirty(tab)).toBe(false);
  });

  it('does not wipe local edits when disk differs from both content and saved baseline', () => {
    const doc = sampleDocument({ content: '# Baseline' });
    let state = tabsReducer(undefined, openMarkdownTab({ doc }));
    const tabId = state.activeTabId;
    state = tabsReducer(state, updateMarkdownContent({ tabId, content: '# My local edit' }));

    state = tabsReducer(
      state,
      reconcileMarkdownTabsFromDocuments({
        collectionId: 10,
        documents: [sampleDocument({ content: '# External change' })]
      })
    );

    const tab = state.tabs.find((entry) => entry.tabId === tabId);
    expect(tab).toBeDefined();
    if (!tab || !isMarkdownTab(tab)) {
      throw new Error('expected markdown tab');
    }
    expect(tab.content).toBe('# My local edit');
    expect(tab.savedContent).toBe('# Baseline');
    expect(isTabDirty(tab)).toBe(true);
  });

  it('closes tabs for documents removed on disk', () => {
    const doc = sampleDocument({ id: 55, content: '# Hello' });
    let state = tabsReducer(undefined, openMarkdownTab({ doc }));
    const tabId = state.activeTabId;

    state = tabsReducer(
      state,
      reconcileMarkdownTabsFromDocuments({
        collectionId: 10,
        documents: []
      })
    );

    expect(state.tabs.some((entry) => entry.tabId === tabId)).toBe(false);
  });
});

describe('tabsSlice reconcileRequestTabsFromRequests', () => {
  it('pulls external disk changes into a clean open request tab', () => {
    let state = tabsReducer(undefined, loadRequest({ req: sampleSaved({ id: 42 }) }));
    const tabId = state.activeTabId;

    state = tabsReducer(
      state,
      reconcileRequestTabsFromRequests({
        collectionId: 10,
        requests: [sampleSaved({ id: 42, url: 'https://example.com/external' })]
      })
    );

    const tab = state.tabs.find((entry) => entry.tabId === tabId);
    expect(tab).toBeDefined();
    if (!tab || !isRequestTab(tab)) {
      throw new Error('expected request tab');
    }
    expect(tab.draft.url).toBe('https://example.com/external?page=1');
    expect(isTabDirty(tab)).toBe(false);
  });

  it('preserves dirty request tabs when disk changes underneath', () => {
    let state = tabsReducer(undefined, loadRequest({ req: sampleSaved({ id: 42 }) }));
    const tabId = state.activeTabId;
    const existingTab = state.tabs.find((entry) => entry.tabId === tabId);
    if (!existingTab || !isRequestTab(existingTab)) {
      throw new Error('expected request tab');
    }
    state = tabsReducer(
      state,
      setActiveDraft({
        ...existingTab.draft,
        url: 'https://example.com/local-edit'
      })
    );

    state = tabsReducer(
      state,
      reconcileRequestTabsFromRequests({
        collectionId: 10,
        requests: [sampleSaved({ id: 42, url: 'https://example.com/external' })]
      })
    );

    const tab = state.tabs.find((entry) => entry.tabId === tabId);
    expect(tab).toBeDefined();
    if (!tab || !isRequestTab(tab)) {
      throw new Error('expected request tab');
    }
    expect(tab.draft.url).toBe('https://example.com/local-edit');
    expect(isTabDirty(tab)).toBe(true);
  });

  it('closes tabs for requests removed on disk', () => {
    let state = tabsReducer(undefined, loadRequest({ req: sampleSaved({ id: 42 }) }));
    const tabId = state.activeTabId;

    state = tabsReducer(
      state,
      reconcileRequestTabsFromRequests({
        collectionId: 10,
        requests: []
      })
    );

    expect(state.tabs.some((entry) => entry.tabId === tabId)).toBe(false);
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
