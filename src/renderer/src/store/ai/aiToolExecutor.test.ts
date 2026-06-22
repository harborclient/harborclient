import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RESPONSE_BODY_CHARS, RESPONSE_BODY_PREVIEW_CHARS } from '#/shared/aiChatContext';
import { defaultAuth } from '#/shared/auth';
import type { Collection, Environment, SavedRequest, SendResult } from '#/shared/types';
import { executeAiTool } from '#/renderer/src/store/ai/aiToolExecutor';
import {
  setCollections,
  setSelectedCollectionId
} from '#/renderer/src/store/slices/collectionsSlice';
import {
  setActiveEnvironmentId,
  setEnvironments
} from '#/renderer/src/store/slices/environmentsSlice';
import { openTabWithDraft, updateTab } from '#/renderer/src/store/slices/tabsSlice';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }
}));

const listRequestsMock = vi.fn<(collectionId: number) => Promise<SavedRequest[]>>();
const sendRequestMock = vi.fn<(req: unknown, requestId?: string) => Promise<SendResult>>();

/**
 * Minimal in-memory localStorage mock for store persistence subscribers.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.stubGlobal('window', {
    api: {
      listRequests: listRequestsMock,
      sendRequest: sendRequestMock,
      runScript: vi.fn().mockResolvedValue({ logs: [], tests: [], error: undefined }),
      cancelRequest: vi.fn()
    }
  });
  listRequestsMock.mockReset();
  listRequestsMock.mockResolvedValue([]);
  sendRequestMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('executeAiTool', () => {
  it('returns the selected collection', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const collection: Collection = {
      id: 1,
      name: 'API',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      created_at: '2026-01-01T00:00:00.000Z'
    };
    store.dispatch(setCollections([collection]));
    store.dispatch(setSelectedCollectionId(1));

    const result = JSON.parse(
      await executeAiTool(
        'get_selected_collection',
        {},
        {
          getState: store.getState,
          dispatch: store.dispatch
        }
      )
    );

    expect(result).toEqual({ id: 1, name: 'API' });
  });

  it('lists environments with active flag', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const environments: Environment[] = [
      {
        id: 2,
        name: 'Staging',
        variables: [],
        created_at: '2026-01-01T00:00:00.000Z'
      }
    ];
    store.dispatch(setEnvironments(environments));
    store.dispatch(setActiveEnvironmentId(2));

    const result = JSON.parse(
      await executeAiTool(
        'list_environments',
        {},
        {
          getState: store.getState,
          dispatch: store.dispatch
        }
      )
    );

    expect(result).toEqual([{ id: 2, name: 'Staging', variables: [], isActive: true }]);
  });

  it('sets the active environment by name', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      setEnvironments([
        {
          id: 3,
          name: 'Production',
          variables: [],
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ])
    );

    const result = JSON.parse(
      await executeAiTool(
        'set_active_environment',
        { name: 'Production' },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ activeEnvironmentId: 3, name: 'Production' });
    expect(store.getState().environments.activeEnvironmentId).toBe(3);
  });

  it('returns active request summary for the open tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 9,
        collection_id: 1,
        folder_id: null,
        name: 'Get users',
        method: 'GET',
        url: 'https://example.com/users',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'get_active_request',
        {},
        {
          getState: store.getState,
          dispatch: store.dispatch
        }
      )
    );

    expect(result.name).toBe('Get users');
    expect(result.savedRequestId).toBe(9);
    expect(result.isDirty).toBe(false);
  });

  it('lists requests via window.api', async () => {
    listRequestsMock.mockResolvedValue([
      {
        id: 4,
        collection_id: 1,
        folder_id: null,
        name: 'Ping',
        method: 'GET',
        url: 'https://example.com/ping',
        headers: [],
        params: [],
        auth: defaultAuth(),
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ]);

    const { store } = await import('#/renderer/src/store/redux');
    const result = JSON.parse(
      await executeAiTool(
        'list_requests',
        { collectionId: 1 },
        {
          getState: store.getState,
          dispatch: store.dispatch
        }
      )
    );

    expect(result).toEqual([
      {
        id: 4,
        name: 'Ping',
        method: 'GET',
        url: 'https://example.com/ping',
        folderId: null
      }
    ]);
  });

  it('returns a compact response summary with a body preview', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 1,
        collection_id: 1,
        folder_id: null,
        name: 'Get users',
        method: 'GET',
        url: 'https://example.com/users',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      })
    );
    const tabId = store.getState().tabs.activeTabId;
    const body = 'a'.repeat(RESPONSE_BODY_PREVIEW_CHARS + 200);
    store.dispatch(
      updateTab({
        tabId,
        updates: {
          response: {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'text/plain' },
            body,
            timeMs: 10,
            sizeBytes: body.length
          },
          testResults: [{ name: 'ok', passed: true }]
        }
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'get_active_response_summary',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result.bodyPreview).toHaveLength(RESPONSE_BODY_PREVIEW_CHARS);
    expect(result.bodyPreviewTruncated).toBe(true);
    expect(result.body).toBeUndefined();
    expect(result.tests).toEqual([{ name: 'ok', passed: true }]);
  });

  it('truncates the full response body to maxBodyChars', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 2,
        collection_id: 1,
        folder_id: null,
        name: 'Large',
        method: 'GET',
        url: 'https://example.com/large',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      })
    );
    const tabId = store.getState().tabs.activeTabId;
    const body = 'b'.repeat(DEFAULT_RESPONSE_BODY_CHARS + 100);
    store.dispatch(
      updateTab({
        tabId,
        updates: {
          response: {
            status: 200,
            statusText: 'OK',
            headers: {},
            body,
            timeMs: 5,
            sizeBytes: body.length
          },
          testResults: []
        }
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'get_active_response',
        { maxBodyChars: 512 },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result.body).toHaveLength(512);
    expect(result.bodyTruncated).toBe(true);
    expect(result.bodyOriginalLength).toBe(body.length);
  });

  it('returns summary mode from send_active_request when maxBodyChars is omitted', async () => {
    const responseBody = 'c'.repeat(RESPONSE_BODY_PREVIEW_CHARS + 100);
    sendRequestMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/plain' },
      body: responseBody,
      timeMs: 12,
      sizeBytes: responseBody.length
    });

    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 3,
        collection_id: 1,
        folder_id: null,
        name: 'Send me',
        method: 'GET',
        url: 'https://example.com/send',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'send_active_request',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(sendRequestMock).toHaveBeenCalled();
    expect(result.bodyPreview).toHaveLength(RESPONSE_BODY_PREVIEW_CHARS);
    expect(result.bodyPreviewTruncated).toBe(true);
    expect(result.body).toBeUndefined();
  });

  it('returns array length from query_response_body', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 5,
        collection_id: 1,
        folder_id: null,
        name: 'Query items',
        method: 'GET',
        url: 'https://example.com/items',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      })
    );
    const tabId = store.getState().tabs.activeTabId;
    const body = JSON.stringify({ data: { items: [{ id: 1 }, { id: 2 }, { id: 3 }] } });
    store.dispatch(
      updateTab({
        tabId,
        updates: {
          response: {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            body,
            timeMs: 8,
            sizeBytes: body.length
          },
          testResults: []
        }
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'query_response_body',
        { expression: 'length(data.items)' },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({
      expression: 'length(data.items)',
      resultType: 'number',
      result: 3
    });
  });

  it('returns nested field values from query_response_body', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 6,
        collection_id: 1,
        folder_id: null,
        name: 'Query field',
        method: 'GET',
        url: 'https://example.com/field',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      })
    );
    const tabId = store.getState().tabs.activeTabId;
    const body = JSON.stringify({ meta: { total: 42 } });
    store.dispatch(
      updateTab({
        tabId,
        updates: {
          response: {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            body,
            timeMs: 4,
            sizeBytes: body.length
          },
          testResults: []
        }
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'query_response_body',
        { expression: 'meta.total' },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({
      expression: 'meta.total',
      resultType: 'number',
      result: 42
    });
  });

  it('returns an error from query_response_body when no response exists', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 7,
        collection_id: 1,
        folder_id: null,
        name: 'No response',
        method: 'GET',
        url: 'https://example.com/none',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'query_response_body',
        { expression: 'length(@)' },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({
      error: 'No HTTP response available. Send the request first.'
    });
  });
});
