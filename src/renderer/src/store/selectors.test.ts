import { describe, expect, it } from 'vitest';
import { defaultAuth, type AuthConfig } from '#/shared/auth';
import type { HttpMethod } from '#/shared/types';
import { createInlineScriptRef } from '#/shared/scriptRefs';
import { isRequestTab } from './tabs';
import {
  loadDocument,
  loadRequest,
  openPageTab,
  openTabWithDraft
} from '#/renderer/src/store/slices/tabsSlice';
import {
  selectEffectiveActiveRequestTab,
  selectOpenDocumentIds,
  selectOpenRequestIds
} from './selectors';

/**
 * Builds a minimal saved request draft for selector tests.
 *
 * @param id - Saved request database id.
 * @param name - Request display name.
 */
function sampleDraft(
  id: number,
  name: string
): {
  id: number;
  collection_id: number;
  folder_id: null;
  name: string;
  method: HttpMethod;
  url: string;
  headers: [];
  params: [];
  body: string;
  body_type: 'none';
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ReturnType<typeof createInlineScriptRef>[];
  post_request_scripts: ReturnType<typeof createInlineScriptRef>[];
  comment: string;
  tags: string;
  auth: AuthConfig;
} {
  return {
    id,
    collection_id: 1,
    folder_id: null,
    name,
    method: 'POST' as const,
    url: 'https://example.com/echo',
    headers: [],
    params: [],
    body: '',
    body_type: 'none' as const,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [] as ReturnType<typeof createInlineScriptRef>[],
    post_request_scripts: [] as ReturnType<typeof createInlineScriptRef>[],
    comment: '',
    tags: '',
    auth: defaultAuth()
  };
}

describe('selectEffectiveActiveRequestTab', () => {
  it('returns the active request tab when it is focused directly', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(openTabWithDraft(sampleDraft(9, 'Get users')));

    const tab = selectEffectiveActiveRequestTab(store.getState());

    expect(tab).toBeDefined();
    expect(tab?.draft.id).toBe(9);
    expect(tab?.draft.name).toBe('Get users');
  });

  it('follows a script-editor page tab link to the linked request tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const script = createInlineScriptRef('hc.test("ok", () => true);', 'SendSuccess');

    store.dispatch(
      openTabWithDraft({
        ...sampleDraft(5000000693, 'Echo'),
        post_request_scripts: [script]
      })
    );

    const requestTabId = store.getState().tabs.activeTabId;
    const requestTab = store.getState().tabs.tabs.find((entry) => entry.tabId === requestTabId);
    expect(requestTab && isRequestTab(requestTab)).toBe(true);

    store.dispatch(
      openPageTab({
        type: 'script-editor',
        requestTabId,
        phase: 'post',
        scriptId: script.id,
        label: 'SendSuccess'
      })
    );

    const effectiveTab = selectEffectiveActiveRequestTab(store.getState());

    expect(effectiveTab?.tabId).toBe(requestTabId);
    expect(effectiveTab?.draft.id).toBe(5000000693);
    expect(effectiveTab?.draft.post_request_scripts[0]?.name).toBe('SendSuccess');
  });

  it('returns undefined when the active tab is unrelated to any request', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(openTabWithDraft(sampleDraft(1, 'Request')));
    store.dispatch(openPageTab({ type: 'settings', section: 'general' }));

    expect(selectEffectiveActiveRequestTab(store.getState())).toBeUndefined();
  });

  it('returns undefined when the script-editor link points at a missing request tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(openTabWithDraft(sampleDraft(2, 'Request')));
    store.dispatch(
      openPageTab({
        type: 'script-editor',
        requestTabId: 'missing-request-tab',
        phase: 'pre',
        scriptId: 'missing-script',
        label: 'Missing'
      })
    );

    expect(selectEffectiveActiveRequestTab(store.getState())).toBeUndefined();
  });
});

describe('selectOpenRequestIds', () => {
  it('includes saved requests from every open request tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const beforeCount = selectOpenRequestIds(store.getState()).size;
    store.dispatch(openTabWithDraft(sampleDraft(11, 'First')));
    store.dispatch(
      loadRequest({
        req: {
          ...sampleDraft(22, 'Second'),
          uuid: 'uuid-22',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z'
        },
        activate: false
      })
    );

    const openRequestIds = selectOpenRequestIds(store.getState());
    expect(openRequestIds.has(11)).toBe(true);
    expect(openRequestIds.has(22)).toBe(true);
    expect(openRequestIds.size).toBe(beforeCount + 2);
  });
});

describe('selectOpenDocumentIds', () => {
  it('includes ids from every open markdown tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const beforeCount = selectOpenDocumentIds(store.getState()).size;
    store.dispatch(
      loadDocument({
        doc: {
          id: 55,
          collection_id: 1,
          folder_id: null,
          uuid: 'doc-uuid',
          name: 'README.md',
          content: '# Docs',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z'
        },
        activate: false
      })
    );

    const openDocumentIds = selectOpenDocumentIds(store.getState());
    expect(openDocumentIds.has(55)).toBe(true);
    expect(openDocumentIds.size).toBe(beforeCount + 1);
  });
});
