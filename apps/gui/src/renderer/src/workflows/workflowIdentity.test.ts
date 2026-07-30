import { describe, expect, it } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { RootState } from '#/renderer/src/store/redux';
import {
  createTab,
  createPageTab,
  createBrowserTab,
  type RequestTab
} from '#/renderer/src/store/tabs';
import {
  findTabByIdentity,
  parseWorkflowTabIdentity,
  resolveEnvironmentIdByUuid,
  resolveEnvironmentUuid,
  resolveTabIdentity,
  resolveWorkspaceIdForPlayback
} from './workflowIdentity';

/**
 * Builds a partial root state for identity helper tests.
 *
 * @param overrides - Partial state fragments to merge.
 * @returns Root state cast for helpers.
 */
function stateWith(overrides: Record<string, unknown>): RootState {
  return {
    workspaces: { items: [] },
    environments: { environments: [], activeEnvironmentId: null },
    tabs: { tabs: [], activeTabId: '' },
    collections: {
      requestsByCollection: {},
      documentsByCollection: {}
    },
    ...overrides
  } as unknown as RootState;
}

describe('workflowIdentity', () => {
  it('resolves request tab identity via saved request uuid', () => {
    const tab = createTab({
      id: 10,
      name: 'List',
      method: 'GET',
      url: 'https://example.com',
      headers: [],
      params: [],
      auth: defaultAuth(),
      userAgent: '',
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
    }) as RequestTab;

    const state = stateWith({
      tabs: { tabs: [tab], activeTabId: tab.tabId },
      collections: {
        requestsByCollection: {
          1: [
            {
              id: 10,
              uuid: 'req-uuid-10',
              collection_id: 1,
              name: 'List',
              method: 'GET',
              url: 'https://example.com'
            }
          ]
        },
        documentsByCollection: {}
      }
    });

    expect(resolveTabIdentity(state, tab.tabId)).toEqual({
      kind: 'request',
      requestUuid: 'req-uuid-10',
      requestId: 10
    });
    expect(
      findTabByIdentity(state, { kind: 'request', requestUuid: 'req-uuid-10', requestId: 10 })
    ).toBe(tab.tabId);
  });

  it('resolves page tab identity and finds it again', () => {
    const tab = createPageTab({ type: 'cookies' });
    const state = stateWith({
      tabs: { tabs: [tab], activeTabId: tab.tabId }
    });
    const identity = resolveTabIdentity(state, tab.tabId);
    expect(identity).toEqual({ kind: 'page', page: { type: 'cookies' } });
    expect(findTabByIdentity(state, identity!)).toBe(tab.tabId);
  });

  it('resolves browser tab identity by tabId and parses it', () => {
    const tab = createBrowserTab({ tabId: 'browser-tab-1', url: 'https://example.com' });
    const state = stateWith({
      tabs: { tabs: [tab], activeTabId: tab.tabId }
    });
    const identity = resolveTabIdentity(state, tab.tabId);
    expect(identity).toEqual({ kind: 'browser', tabId: 'browser-tab-1' });
    expect(findTabByIdentity(state, identity!)).toBe(tab.tabId);
    expect(parseWorkflowTabIdentity({ kind: 'browser', tabId: 'browser-tab-1' })).toEqual({
      kind: 'browser',
      tabId: 'browser-tab-1'
    });
    expect(parseWorkflowTabIdentity({ kind: 'browser', tabId: '' })).toBeNull();
  });

  it('resolves environment uuid and id', () => {
    const state = stateWith({
      environments: {
        environments: [{ id: 3, uuid: 'env-3', name: 'Staging' }],
        activeEnvironmentId: 3
      }
    });
    expect(resolveEnvironmentUuid(state, 3)).toBe('env-3');
    expect(resolveEnvironmentUuid(state, null)).toBeNull();
    expect(resolveEnvironmentIdByUuid(state, 'env-3')).toBe(3);
  });

  it('resolves workspace by id then name', () => {
    const state = stateWith({
      workspaces: {
        items: [{ id: 7, name: 'Demo', requests: [], createdAt: 0, updatedAt: 0 }]
      }
    });
    expect(resolveWorkspaceIdForPlayback(state, { id: 7 })).toBe(7);
    expect(resolveWorkspaceIdForPlayback(state, { name: 'Demo' })).toBe(7);
    expect(resolveWorkspaceIdForPlayback(state, { id: 99, name: 'Missing' })).toBeNull();
  });
});
