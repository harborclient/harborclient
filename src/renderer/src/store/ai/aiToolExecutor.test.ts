import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RESPONSE_BODY_CHARS, RESPONSE_BODY_PREVIEW_CHARS } from '#/shared/ai/chatContext';
import { defaultAuth } from '#/shared/auth';
import { createInlineScriptRef, createSnippetScriptRef } from '#/shared/scriptRefs';
import type {
  Collection,
  Environment,
  Folder,
  KeyValue,
  SavedRequest,
  SendResult
} from '#/shared/types';
import { executeAiTool } from '#/renderer/src/store/ai/aiToolExecutor';
import {
  setCollections,
  setFoldersForCollection,
  setRequestsForCollection,
  setSelectedCollectionId
} from '#/renderer/src/store/slices/collectionsSlice';
import {
  setActiveEnvironmentId,
  setEnvironments
} from '#/renderer/src/store/slices/environmentsSlice';
import { openTabWithDraft, updateTab } from '#/renderer/src/store/slices/tabsSlice';
import { addTerminal, hydrateTerminals } from '#/renderer/src/store/slices/terminalsSlice';
import { setShowTerminal } from '#/renderer/src/store/slices/navigationSlice';
import { selectDraft } from '#/renderer/src/store/selectors';
import {
  clearTerminalRegistry,
  getTerminalInstance,
  registerTerminalInstance
} from '#/renderer/src/ui/Footer/TerminalPanel/terminalRegistry';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }
}));

const listRequestsMock = vi.fn<(collectionId: number) => Promise<SavedRequest[]>>();
const listFoldersMock = vi.fn<(collectionId: number) => Promise<Folder[]>>();
const sendRequestMock = vi.fn<(req: unknown, requestId?: string) => Promise<SendResult>>();
const getCookiesMock = vi.fn<(domain: string) => Promise<KeyValue[]>>();
const setCookiesMock = vi.fn<(domain: string, cookies: KeyValue[]) => Promise<void>>();
const searchDocsMock = vi.fn<(args: { query: string }) => Promise<string>>();
const writeTerminalMock = vi.fn<(id: string, data: string) => void>();

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
    platform: 'linux',
    operatingSystemInfo: {
      platform: 'linux',
      type: 'Linux',
      release: '6.8.0-134-generic',
      arch: 'x64'
    },
    api: {
      listRequests: listRequestsMock,
      listFolders: listFoldersMock,
      sendRequest: sendRequestMock,
      pushPluginHttpAfterSend: vi.fn().mockResolvedValue(undefined),
      getCookies: getCookiesMock,
      setCookies: setCookiesMock,
      searchDocs: searchDocsMock,
      writeTerminal: writeTerminalMock,
      runScript: vi.fn().mockResolvedValue({ logs: [], tests: [], error: undefined }),
      cancelRequest: vi.fn()
    }
  });
  clearTerminalRegistry();
  listRequestsMock.mockReset();
  listRequestsMock.mockResolvedValue([]);
  listFoldersMock.mockReset();
  listFoldersMock.mockResolvedValue([]);
  sendRequestMock.mockReset();
  getCookiesMock.mockReset();
  getCookiesMock.mockResolvedValue([]);
  setCookiesMock.mockReset();
  setCookiesMock.mockResolvedValue(undefined);
  searchDocsMock.mockReset();
  searchDocsMock.mockResolvedValue('[]');
  writeTerminalMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearTerminalRegistry();
});

/**
 * Resets footer terminal layout state in the shared test store.
 *
 * @param store - Redux store used by executeAiTool tests.
 */
async function resetTerminalLayout(
  store: Awaited<typeof import('#/renderer/src/store/redux')>['store']
): Promise<void> {
  store.dispatch(
    hydrateTerminals({
      terminals: [],
      activeTerminalId: null,
      selectionSnapshots: {}
    })
  );
}

/**
 * Builds a minimal xterm-like terminal stub with a readable buffer.
 *
 * @param lineTexts - Plain-text lines stored in the active buffer.
 */
function createTerminalBufferStub(lineTexts: string[]): {
  buffer: {
    active: {
      length: number;
      getLine: (
        index: number
      ) => { translateToString: (trimRight?: boolean) => string } | undefined;
    };
  };
} {
  return {
    buffer: {
      active: {
        length: lineTexts.length,
        getLine: (index: number) => ({
          translateToString: (trimRight?: boolean) => {
            void trimRight;
            return lineTexts[index] ?? '';
          }
        })
      }
    }
  };
}

describe('executeAiTool', () => {
  it('returns the selected collection', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const collection: Collection = {
      id: 1,
      uuid: '',
      name: 'API',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
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
        uuid: '',
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
          uuid: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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
        uuid: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
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

  it('returns active request details with cookies for the URL host', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    getCookiesMock.mockResolvedValue([{ key: 'session', value: 'abc', enabled: true }]);
    store.dispatch(
      openTabWithDraft({
        id: 8,
        collection_id: 1,
        folder_id: null,
        name: 'With cookies',
        method: 'GET',
        url: 'https://example.com/data',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'get_active_request_details',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(getCookiesMock).toHaveBeenCalledWith('example.com');
    expect(result.cookies).toEqual([{ key: 'session', value: 'abc', enabled: true }]);
  });

  it('updates post_request_script and marks the draft dirty', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 10,
        collection_id: 1,
        folder_id: null,
        name: 'Script test',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'update_active_request',
        {
          post_request_script:
            "hc.test('Status is 200', function () { hc.expect(hc.response.code).to.equal(200); });"
        },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    const draft = selectDraft(store.getState());
    expect(result.ok).toBe(true);
    expect(result.isDirty).toBe(true);
    expect(draft.post_request_script).toContain("hc.test('Status is 200'");
  });

  it('merges headers by key via update_active_request', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 11,
        collection_id: 1,
        folder_id: null,
        name: 'Headers',
        method: 'GET',
        url: 'https://example.com',
        headers: [{ key: 'Accept', value: 'text/plain', enabled: true }],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await executeAiTool(
      'update_active_request',
      { headers: [{ key: 'Authorization', value: 'Bearer token' }] },
      { getState: store.getState, dispatch: store.dispatch }
    );

    const headers = selectDraft(store.getState()).headers;
    expect(headers.some((row) => row.key === 'Accept' && row.value === 'text/plain')).toBe(true);
    expect(headers.some((row) => row.key === 'Authorization')).toBe(true);
  });

  it('syncs params when the url changes via update_active_request', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 12,
        collection_id: 1,
        folder_id: null,
        name: 'Params sync',
        method: 'GET',
        url: 'https://example.com?page=1',
        headers: [],
        params: [{ key: 'page', value: '1', enabled: true }],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await executeAiTool(
      'update_active_request',
      { url: 'https://example.com?limit=10' },
      { getState: store.getState, dispatch: store.dispatch }
    );

    const draft = selectDraft(store.getState());
    expect(draft.url).toBe('https://example.com?limit=10');
    expect(draft.params.some((row) => row.key === 'limit' && row.value === '10')).toBe(true);
  });

  it('persists cookies for the request host via update_active_request', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    getCookiesMock.mockResolvedValue([{ key: 'existing', value: '1', enabled: true }]);
    store.dispatch(
      openTabWithDraft({
        id: 13,
        collection_id: 1,
        folder_id: null,
        name: 'Cookies',
        method: 'GET',
        url: 'https://api.example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await executeAiTool(
      'update_active_request',
      { cookies: [{ key: 'session', value: 'xyz' }] },
      { getState: store.getState, dispatch: store.dispatch }
    );

    expect(getCookiesMock).toHaveBeenCalledWith('api.example.com');
    expect(setCookiesMock).toHaveBeenCalledWith('api.example.com', [
      { key: 'existing', value: '1', enabled: true },
      { key: 'session', value: 'xyz', enabled: true }
    ]);
  });

  it('returns an error when update_active_request has no fields', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 14,
        collection_id: 1,
        folder_id: null,
        name: 'Empty patch',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'update_active_request',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ error: 'Provide at least one field to update.' });
  });

  it('returns indexed pre and post scripts from get_active_request_details', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const preScript = createInlineScriptRef('console.log("pre");', 'Pre script');
    const postScript = createInlineScriptRef(
      "hc.test('ok', function () { hc.expect(hc.response.code).to.equal(200); });",
      'Status test'
    );

    store.dispatch(
      openTabWithDraft({
        id: 20,
        collection_id: 1,
        folder_id: null,
        name: 'Script details',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [preScript],
        post_request_scripts: [postScript],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'get_active_request_details',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result.pre_request_scripts).toEqual([
      { index: 1, name: 'Pre script', kind: 'inline', code: 'console.log("pre");' }
    ]);
    expect(result.post_request_scripts[0]).toMatchObject({
      index: 1,
      name: 'Status test',
      kind: 'inline'
    });
    expect(result.post_request_scripts[0].code).toContain("hc.test('ok'");
  });

  it('updates an inline script by phase and 1-based index via update_request_script', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const first = createInlineScriptRef('console.log("first");', 'First');
    const second = createInlineScriptRef('console.log("second");', 'Second');

    store.dispatch(
      openTabWithDraft({
        id: 21,
        collection_id: 1,
        folder_id: null,
        name: 'Indexed script',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [first, second],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'update_request_script',
        {
          requestId: 21,
          phase: 'pre',
          scriptIndex: 2,
          code: 'console.log("updated");'
        },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    const draft = selectDraft(store.getState());
    expect(result).toEqual({ ok: true, phase: 'pre', scriptIndex: 2, isDirty: true });
    expect(draft.pre_request_scripts[1].code).toBe('console.log("updated");');
    expect(draft.pre_request_scripts[0].code).toBe('console.log("first");');
  });

  it('appends to an inline script via update_request_script', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const script = createInlineScriptRef('console.log("start");');

    store.dispatch(
      openTabWithDraft({
        id: 22,
        collection_id: 1,
        folder_id: null,
        name: 'Append script',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [script],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    await executeAiTool(
      'update_request_script',
      {
        requestId: 22,
        phase: 'pre',
        scriptIndex: 1,
        code: 'console.log("end");',
        mode: 'append'
      },
      { getState: store.getState, dispatch: store.dispatch }
    );

    expect(selectDraft(store.getState()).pre_request_scripts[0].code).toBe(
      'console.log("start");\nconsole.log("end");'
    );
  });

  it('returns an error when update_request_script index is out of range', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 23,
        collection_id: 1,
        folder_id: null,
        name: 'Out of range',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [createInlineScriptRef('only one')],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'update_request_script',
        {
          requestId: 23,
          phase: 'pre',
          scriptIndex: 3,
          code: 'noop();'
        },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result.error).toContain('out of range');
  });

  it('returns an error when update_request_script targets a snippet-linked row', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 24,
        collection_id: 1,
        folder_id: null,
        name: 'Snippet row',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [createSnippetScriptRef('snippet-uuid', 'Shared snippet')],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'update_request_script',
        {
          requestId: 24,
          phase: 'pre',
          scriptIndex: 1,
          code: 'noop();'
        },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result.error).toContain('snippet-linked');
  });

  it('returns an error when update_request_script request id does not match the active tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    store.dispatch(
      openTabWithDraft({
        id: 25,
        collection_id: 1,
        folder_id: null,
        name: 'Wrong id',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [createInlineScriptRef('code')],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'update_request_script',
        {
          requestId: 99,
          phase: 'pre',
          scriptIndex: 1,
          code: 'noop();'
        },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result.error).toContain('does not match the active request tab');
  });

  it('accepts requestId active for a saved request on the active tab', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const script = createInlineScriptRef('console.log("before");');

    store.dispatch(
      openTabWithDraft({
        id: 3,
        collection_id: 1,
        folder_id: null,
        name: 'Saved request 3',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        pre_request_scripts: [script],
        post_request_scripts: [],
        comment: '',
        tags: '',
        auth: defaultAuth()
      })
    );

    const result = JSON.parse(
      await executeAiTool(
        'update_request_script',
        {
          requestId: 'active',
          phase: 'pre',
          scriptIndex: 1,
          code: 'console.log("after");'
        },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ ok: true, phase: 'pre', scriptIndex: 1, isDirty: true });
    expect(selectDraft(store.getState()).pre_request_scripts[0].code).toBe('console.log("after");');
  });

  it('returns a collection by uuid from Redux', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const collectionUuid = '11111111-1111-1111-1111-111111111111';
    const collection: Collection = {
      id: 1,
      uuid: collectionUuid,
      name: 'API',
      variables: [{ key: 'baseUrl', value: 'https://example.com', defaultValue: '', share: true }],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      created_at: '2026-01-01T00:00:00.000Z'
    };
    store.dispatch(setCollections([collection]));

    const result = JSON.parse(
      await executeAiTool(
        'get_collection',
        { uuid: collectionUuid },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toMatchObject({
      id: 1,
      uuid: collectionUuid,
      name: 'API'
    });
    expect(result.variables).toEqual(collection.variables);
  });

  it('returns a folder by uuid from Redux', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const folderUuid = '22222222-2222-2222-2222-222222222222';
    const folder: Folder = {
      id: 10,
      collection_id: 1,
      uuid: folderUuid,
      name: 'Auth',
      sort_order: 0,
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      created_at: '2026-01-01T00:00:00.000Z'
    };
    store.dispatch(
      setCollections([
        {
          id: 1,
          uuid: '11111111-1111-1111-1111-111111111111',
          name: 'API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [],
          post_request_scripts: [],
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    store.dispatch(setFoldersForCollection({ collectionId: 1, folders: [folder] }));

    const result = JSON.parse(
      await executeAiTool(
        'get_folder',
        { uuid: folderUuid },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toMatchObject({
      id: 10,
      uuid: folderUuid,
      name: 'Auth'
    });
  });

  it('falls back to listFolders when a folder is not cached in Redux', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const folderUuid = '22222222-2222-2222-2222-222222222222';
    const folder: Folder = {
      id: 10,
      collection_id: 1,
      uuid: folderUuid,
      name: 'Auth',
      sort_order: 0,
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      created_at: '2026-01-01T00:00:00.000Z'
    };
    store.dispatch(
      setCollections([
        {
          id: 1,
          uuid: '11111111-1111-1111-1111-111111111111',
          name: 'API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [],
          post_request_scripts: [],
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    store.dispatch(setFoldersForCollection({ collectionId: 1, folders: [] }));
    listFoldersMock.mockResolvedValue([folder]);

    const result = JSON.parse(
      await executeAiTool(
        'get_folder',
        { uuid: folderUuid },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(listFoldersMock).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ uuid: folderUuid, name: 'Auth' });
  });

  it('returns a saved request by uuid from Redux', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const requestUuid = '33333333-3333-3333-3333-333333333333';
    const request: SavedRequest = {
      id: 4,
      uuid: requestUuid,
      collection_id: 1,
      folder_id: null,
      name: 'Login',
      method: 'POST',
      url: 'https://example.com/login',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '{}',
      body_type: 'json',
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    };
    store.dispatch(
      setCollections([
        {
          id: 1,
          uuid: '11111111-1111-1111-1111-111111111111',
          name: 'API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [],
          post_request_scripts: [],
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    store.dispatch(setRequestsForCollection({ collectionId: 1, requests: [request] }));

    const result = JSON.parse(
      await executeAiTool(
        'get_request',
        { uuid: requestUuid },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toMatchObject({
      id: 4,
      uuid: requestUuid,
      name: 'Login',
      method: 'POST'
    });
  });

  it('falls back to listRequests when a saved request is not cached in Redux', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const requestUuid = '33333333-3333-3333-3333-333333333333';
    const request: SavedRequest = {
      id: 4,
      uuid: requestUuid,
      collection_id: 1,
      folder_id: null,
      name: 'Login',
      method: 'POST',
      url: 'https://example.com/login',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '{}',
      body_type: 'json',
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: '',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    };
    store.dispatch(
      setCollections([
        {
          id: 1,
          uuid: '11111111-1111-1111-1111-111111111111',
          name: 'API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [],
          post_request_scripts: [],
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    store.dispatch(setRequestsForCollection({ collectionId: 1, requests: [] }));
    listRequestsMock.mockResolvedValue([request]);

    const result = JSON.parse(
      await executeAiTool(
        'get_request',
        { uuid: requestUuid },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(listRequestsMock).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ uuid: requestUuid, name: 'Login' });
  });

  it('delegates search_docs to window.api.searchDocs', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const payload = JSON.stringify([
      {
        title: 'Scripting',
        heading: 'Pre-request scripts',
        url: 'https://harborclient.com/scripting',
        source: 'site',
        path: 'scripting.md',
        score: 0.9,
        snippet: 'Pre-request scripts run before each request.'
      }
    ]);
    searchDocsMock.mockResolvedValue(payload);

    const result = await executeAiTool(
      'search_docs',
      { query: 'pre-request scripts', limit: 3 },
      { getState: store.getState, dispatch: store.dispatch }
    );

    expect(searchDocsMock).toHaveBeenCalledWith({ query: 'pre-request scripts', limit: 3 });
    expect(result).toBe(payload);
  });

  it('returns active terminal summary info', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());
    const activeTerminalId = store.getState().terminals.activeTerminalId;
    const activeTerminal = store
      .getState()
      .terminals.terminals.find((terminal) => terminal.id === activeTerminalId);
    registerTerminalInstance(
      activeTerminal!.id,
      createTerminalBufferStub(['line1', 'line2', 'line3']) as never
    );

    const result = JSON.parse(
      await executeAiTool(
        'get_active_terminal',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({
      terminalId: activeTerminal!.id,
      title: 'Terminal 1',
      terminalIndex: 1,
      totalLines: 3,
      operatingSystem: {
        platform: 'linux',
        type: 'Linux',
        release: '6.8.0-134-generic',
        arch: 'x64'
      }
    });
  });

  it('returns an error when no active terminal exists', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);

    const result = JSON.parse(
      await executeAiTool(
        'get_active_terminal',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ error: 'No active terminal.' });
  });

  it('returns an error when the active terminal buffer is not ready', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());

    const result = JSON.parse(
      await executeAiTool(
        'get_active_terminal',
        {},
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ error: 'Active terminal is not ready yet.' });
  });

  it('returns a requested line range from the active terminal', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());
    const activeTerminalId = store.getState().terminals.activeTerminalId;
    const activeTerminal = store
      .getState()
      .terminals.terminals.find((terminal) => terminal.id === activeTerminalId);
    registerTerminalInstance(
      activeTerminal!.id,
      createTerminalBufferStub(['alpha', 'beta', 'gamma', 'delta']) as never
    );

    const result = JSON.parse(
      await executeAiTool(
        'get_active_terminal_lines',
        { startLine: 2, endLine: 3 },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({
      startLine: 2,
      endLine: 3,
      totalLines: 4,
      lines: 'beta\ngamma'
    });
  });

  it('clamps terminal line ranges to the available buffer', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());
    const activeTerminalId = store.getState().terminals.activeTerminalId;
    const activeTerminal = store
      .getState()
      .terminals.terminals.find((terminal) => terminal.id === activeTerminalId);
    registerTerminalInstance(activeTerminal!.id, createTerminalBufferStub(['only line']) as never);

    const result = JSON.parse(
      await executeAiTool(
        'get_active_terminal_lines',
        { startLine: 1, endLine: 99 },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({
      startLine: 1,
      endLine: 1,
      totalLines: 1,
      lines: 'only line'
    });
  });

  it('returns an error for invalid terminal line arguments', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());
    const activeTerminalId = store.getState().terminals.activeTerminalId;
    const activeTerminal = store
      .getState()
      .terminals.terminals.find((terminal) => terminal.id === activeTerminalId);
    registerTerminalInstance(activeTerminal!.id, createTerminalBufferStub(['line']) as never);

    const result = JSON.parse(
      await executeAiTool(
        'get_active_terminal_lines',
        { startLine: 5, endLine: 2 },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ error: 'startLine must be less than or equal to endLine.' });
    expect(getTerminalInstance(activeTerminal!.id)).toBeDefined();
  });

  it('writes input to the active terminal shell', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());
    store.dispatch(setShowTerminal(true));
    const activeTerminalId = store.getState().terminals.activeTerminalId;

    const result = JSON.parse(
      await executeAiTool(
        'terminal_exec',
        { input: 'cd foo\n' },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ ok: true });
    expect(writeTerminalMock).toHaveBeenCalledWith(activeTerminalId, 'cd foo\n');
  });

  it('returns an error when terminal_exec is called with the panel closed', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());
    store.dispatch(setShowTerminal(false));

    const result = JSON.parse(
      await executeAiTool(
        'terminal_exec',
        { input: 'pwd\n' },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({
      error: 'Terminal panel is closed. Open the terminal panel before sending input.'
    });
    expect(writeTerminalMock).not.toHaveBeenCalled();
  });

  it('returns an error when terminal_exec input is missing', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    await resetTerminalLayout(store);
    store.dispatch(addTerminal());
    store.dispatch(setShowTerminal(true));

    const result = JSON.parse(
      await executeAiTool(
        'terminal_exec',
        { input: '' },
        { getState: store.getState, dispatch: store.dispatch }
      )
    );

    expect(result).toEqual({ error: 'input is required.' });
    expect(writeTerminalMock).not.toHaveBeenCalled();
  });
});
