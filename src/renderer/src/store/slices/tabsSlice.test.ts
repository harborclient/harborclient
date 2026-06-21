import { describe, expect, it } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { SavedRequest, ScriptTestResult, SendResult } from '#/shared/types';
import { draftFromSaved, isTabDirty } from '#/renderer/src/store/drafts';
import tabsReducer, { loadRequest, openTabWithDraft } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Builds a saved request fixture for loadRequest tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Saved request suitable for reducer actions.
 */
function sampleSaved(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 1,
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
    comment: '',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('tabsSlice loadRequest', () => {
  it('opens a new tab when no tab exists for the saved request id', () => {
    const initial = tabsReducer(undefined, { type: 'unknown' });
    const req = sampleSaved();

    const state = tabsReducer(initial, loadRequest(req));

    expect(state.tabs).toHaveLength(initial.tabs.length + 1);
    expect(state.tabs[state.tabs.length - 1]?.draft).toEqual(draftFromSaved(req));
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
        comment: ''
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
    const tab = state.tabs.find((t) => t.tabId === tabId);

    expect(state.activeTabId).toBe(tabId);
    expect(state.tabs).toHaveLength(initial.tabs.length);
    expect(tab?.draft).toEqual(draftFromSaved(updated));
    expect(tab?.savedDraft).toEqual(draftFromSaved(updated));
    expect(isTabDirty(tab!)).toBe(false);
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
        comment: ''
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

    const tab = state.tabs.find((t) => t.tabId === tabId);
    expect(tab?.response).toBeNull();
    expect(tab?.testResults).toEqual([]);
  });
});
