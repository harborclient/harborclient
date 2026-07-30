import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { SavedRequest } from '@harborclient/core/types';
import {
  browserGoBack,
  browserGoForward,
  browserGoHome,
  browserNavigate,
  browserReload,
  loadRequest,
  newBrowserTab,
  newTab,
  restoreTabsState,
  setActiveDraft
} from '#/renderer/src/store/slices/tabsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { createBrowserTab, createTab } from '#/renderer/src/store/tabs';
import { SEND_REQUEST_PENDING_TYPE } from '#/renderer/src/store/thunks/sendRequestType';
import {
  OPEN_WORKSPACE_FULFILLED_TYPE,
  OPEN_WORKSPACE_PENDING_TYPE
} from '#/renderer/src/store/thunks/openWorkspaceType';
import { SAVE_REQUEST_FULFILLED_TYPE } from '#/renderer/src/store/thunks/saveRequestType';
import { CANCEL_REQUEST_PENDING_TYPE } from '#/renderer/src/store/thunks/cancelRequestType';
import { NEW_REQUEST_IN_COLLECTION_FULFILLED_TYPE } from '#/renderer/src/store/thunks/createRequestType';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import {
  clearSession,
  getRecordingElapsedMs,
  getSessionEvents,
  getWorkflowLogApi,
  isRecording,
  isWorkspaceFanOutSuppressed,
  processWorkflowAction,
  resetWorkflowRecorderForTests,
  seekRecordingTo,
  startRecording,
  stopRecording,
  replaceSessionActions
} from './workflowRecorder';
import { WorkflowEventSink } from './workflowEventSink';

/**
 * Builds a minimal saved request for loadRequest recording tests.
 *
 * @param overrides - Partial fields to merge onto defaults.
 * @returns Saved request fixture.
 */
function sampleRequest(overrides: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: 10,
    uuid: 'req-uuid-10',
    collection_id: 1,
    name: 'List things',
    method: 'GET',
    url: 'https://example.com/things',
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
    tags: '',
    folder_id: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...overrides
  };
}

/**
 * Builds a request draft payload for setActiveDraft recording tests.
 *
 * @param overrides - Fields to overlay on the base draft.
 * @returns Draft-shaped object accepted by the registry.
 */
function sampleDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 10,
    collection_id: 1,
    folder_id: null,
    name: 'List things',
    method: 'GET',
    url: 'https://example.com/things',
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
    tags: '',
    ...overrides
  };
}

/**
 * Minimal getState stub for recorder tests that do not need store identity.
 *
 * @returns Empty-ish root state cast.
 */
function emptyGetState(): RootState {
  return {
    workspaces: { items: [] },
    environments: { environments: [], activeEnvironmentId: null },
    tabs: { tabs: [], activeTabId: '' },
    collections: { requestsByCollection: {}, documentsByCollection: {} }
  } as unknown as RootState;
}

/**
 * getState stub with an active request tab for send display-field capture.
 *
 * @param draftOverrides - Fields merged onto the active tab draft.
 * @returns Root state with one active request tab.
 */
function getStateWithActiveRequest(draftOverrides: Record<string, unknown> = {}): () => RootState {
  const draft = {
    id: 10,
    collection_id: 1,
    folder_id: null,
    name: 'List things',
    method: 'GET',
    url: 'https://example.com/things?a=2',
    ...draftOverrides
  };
  return () =>
    ({
      ...emptyGetState(),
      tabs: {
        tabs: [
          {
            tabId: 'tab-1',
            draft,
            savedDraft: draft,
            response: null,
            sending: false,
            sendingRequestId: null,
            testResults: [],
            scriptLogs: [],
            executionEvents: []
          }
        ],
        activeTabId: 'tab-1'
      }
    }) as unknown as RootState;
}

/**
 * Dispatches a workflow action through the recorder with a getState stub.
 *
 * @param action - Redux-like action.
 * @param getState - Optional state provider.
 */
function record(
  action: { type: string; payload?: unknown; meta?: unknown },
  getState = emptyGetState
): void {
  processWorkflowAction(action as never, getState);
}

beforeEach(() => {
  resetWorkflowRecorderForTests();
  vi.stubGlobal('window', { __workflowLog: undefined });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  resetWorkflowRecorderForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('processWorkflowAction', () => {
  it('ignores actions while the session is stopped', () => {
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    expect(getWorkflowLogApi().events).toEqual([]);
  });

  it('ignores actions that are not in the registry', () => {
    startRecording();
    record({ type: 'tabs/updateTab', payload: { tabId: 'x', updates: {} } });
    getWorkflowLogApi().flush();
    expect(getWorkflowLogApi().events).toEqual([]);
  });

  it('records load, coalesced drafts, and send in order', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    record({
      type: setActiveDraft.type,
      payload: sampleDraft({
        url: 'https://example.com/things?a=1',
        headers: [{ key: 'X-Test', value: '1', enabled: true }]
      })
    });
    record({
      type: setActiveDraft.type,
      payload: sampleDraft({
        url: 'https://example.com/things?a=2',
        headers: [{ key: 'X-Test', value: '2', enabled: true }]
      })
    });
    record(
      {
        type: SEND_REQUEST_PENDING_TYPE,
        meta: { requestId: 'r1', arg: undefined }
      },
      getStateWithActiveRequest({
        url: 'https://example.com/things?a=2'
      })
    );

    const events = getWorkflowLogApi().events;
    expect(events.map((entry) => entry.type)).toEqual([
      'request.load',
      'request.draft',
      'request.send'
    ]);
    expect(events[0]?.payload).toMatchObject({
      id: 10,
      uuid: 'req-uuid-10',
      name: 'List things'
    });
    expect(events[1]?.payload).toMatchObject({
      url: 'https://example.com/things?a=2',
      headers: [{ key: 'X-Test', value: '2', enabled: true }]
    });
    expect(events[2]?.payload).toEqual({
      target: 'active',
      method: 'GET',
      name: 'List things',
      url: 'https://example.com/things?a=2'
    });
  });

  it('coalesces request.load by uuid', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest({ id: 1, uuid: 'same-uuid' }), activate: true }
    });
    record({
      type: loadRequest.type,
      payload: {
        req: sampleRequest({ id: 99, uuid: 'same-uuid', name: 'Renamed' }),
        activate: true
      }
    });
    const events = getWorkflowLogApi().events;
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({ uuid: 'same-uuid', name: 'Renamed', id: 99 });
  });

  it('records environment.activate with uuid from getState', () => {
    startRecording();
    record(
      { type: setActiveEnvironmentId.type, payload: 5 },
      () =>
        ({
          ...emptyGetState(),
          environments: {
            environments: [{ id: 5, uuid: 'env-uuid-5', name: 'Local' }],
            activeEnvironmentId: 5
          }
        }) as unknown as RootState
    );
    expect(getWorkflowLogApi().events[0]?.payload).toEqual({
      environmentId: 5,
      uuid: 'env-uuid-5'
    });
  });

  it('suppresses request.load fan-out during workspace.open', () => {
    startRecording();
    record(
      { type: OPEN_WORKSPACE_PENDING_TYPE, meta: { arg: 1 } },
      () =>
        ({
          ...emptyGetState(),
          workspaces: {
            items: [
              {
                id: 1,
                name: 'API',
                requests: [{ requestUuid: 'req-uuid-10' }],
                createdAt: 0,
                updatedAt: 0
              }
            ]
          }
        }) as unknown as RootState
    );
    expect(isWorkspaceFanOutSuppressed()).toBe(true);
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    record({ type: setActiveEnvironmentId.type, payload: 5 });
    record({ type: OPEN_WORKSPACE_FULFILLED_TYPE, meta: { arg: 1 } });
    expect(isWorkspaceFanOutSuppressed()).toBe(false);

    const events = getWorkflowLogApi().events;
    expect(events.map((entry) => entry.type)).toEqual(['workspace.open']);
    expect(events[0]?.payload).toMatchObject({
      id: 1,
      name: 'API',
      requestUuids: ['req-uuid-10']
    });
  });

  it('records save, create, and cancel shapes', () => {
    startRecording();
    record({
      type: SAVE_REQUEST_FULFILLED_TYPE,
      payload: sampleRequest({ uuid: 'saved-uuid', name: 'Saved' })
    });
    record({
      type: NEW_REQUEST_IN_COLLECTION_FULFILLED_TYPE,
      payload: sampleRequest({ uuid: 'created-uuid', folder_id: null, name: 'Untitled Request' })
    });
    record({ type: CANCEL_REQUEST_PENDING_TYPE, meta: { arg: 'tab-1' } });

    const events = getWorkflowLogApi().events;
    expect(events.map((entry) => entry.type)).toEqual([
      'request.save',
      'request.create',
      'request.cancel'
    ]);
    expect(events[0]?.payload).toMatchObject({ uuid: 'saved-uuid', name: 'Saved' });
    expect(events[1]?.payload).toMatchObject({
      uuid: 'created-uuid',
      collectionId: 1,
      folderId: null
    });
    expect(events[2]?.payload).toEqual({ target: 'active' });
  });

  it('appends across stop and start cycles', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    stopRecording();
    record({
      type: SEND_REQUEST_PENDING_TYPE,
      meta: { requestId: 'r1' }
    });
    startRecording();
    record({
      type: SEND_REQUEST_PENDING_TYPE,
      meta: { requestId: 'r2' }
    });

    expect(getWorkflowLogApi().events.map((entry) => entry.type)).toEqual([
      'request.load',
      'request.send'
    ]);
  });

  it('accumulates elapsed time only while recording', () => {
    startRecording();
    vi.advanceTimersByTime(1_500);
    expect(getRecordingElapsedMs()).toBe(1_500);
    stopRecording();
    vi.advanceTimersByTime(5_000);
    expect(getRecordingElapsedMs()).toBe(1_500);
    startRecording();
    vi.advanceTimersByTime(500);
    expect(getRecordingElapsedMs()).toBe(2_000);
    expect(isRecording()).toBe(true);
  });

  it('clearSession removes flushed history and resets the timer', () => {
    startRecording();
    record({ type: SEND_REQUEST_PENDING_TYPE, meta: { requestId: 'r1' } });
    vi.advanceTimersByTime(1_000);
    const api = getWorkflowLogApi();
    expect(api.events).toHaveLength(1);
    clearSession();
    expect(api.events).toEqual([]);
    expect(getRecordingElapsedMs()).toBe(0);
    expect(isRecording()).toBe(false);
  });
});

describe('WorkflowEventSink.truncateTo', () => {
  it('drops events after the inclusive index', () => {
    const sink = new WorkflowEventSink(10);
    sink.append({ uuid: 'a', type: 'a', at: 1, payload: {} });
    sink.append({ uuid: 'b', type: 'b', at: 2, payload: {} });
    sink.append({ uuid: 'c', type: 'c', at: 3, payload: {} });
    sink.truncateTo(0);
    expect(sink.getEvents().map((event) => event.uuid)).toEqual(['a']);
  });
});

describe('seekRecordingTo', () => {
  /**
   * Builds getState with a fixed tab list for checkpoint capture.
   *
   * @param tabs - Open tabs to expose.
   * @param activeTabId - Active tab id.
   * @returns getState stub.
   */
  function getStateWithTabs(
    tabs: ReturnType<typeof createTab>[],
    activeTabId: string
  ): () => RootState {
    return () =>
      ({
        ...emptyGetState(),
        tabs: { tabs, activeTabId },
        environments: { environments: [], activeEnvironmentId: null }
      }) as unknown as RootState;
  }

  it('rewinds tabs while paused without deleting later actions', () => {
    const tabA = { ...createTab(), tabId: 'tab-a' };
    const tabB = { ...createTab(), tabId: 'tab-b' };

    startRecording();
    record(
      {
        type: loadRequest.type,
        payload: { req: sampleRequest(), activate: true }
      },
      getStateWithTabs([tabA], 'tab-a')
    );
    vi.advanceTimersByTime(400);
    record({ type: newTab.type }, getStateWithTabs([tabA, tabB], 'tab-b'));
    stopRecording();

    expect(getSessionEvents().map((event) => event.type)).toEqual(['request.load', 'tab.new']);

    const dispatch = vi.fn();
    const playhead = seekRecordingTo(0, { dispatch: dispatch as unknown as AppDispatch });

    expect(playhead).toBe(0);
    expect(getSessionEvents().map((event) => event.type)).toEqual(['request.load', 'tab.new']);
    expect(dispatch).toHaveBeenCalledWith(
      restoreTabsState({
        tabs: [tabA],
        activeTabId: 'tab-a'
      })
    );
    expect(dispatch).toHaveBeenCalledWith(setActiveEnvironmentId(null));
  });

  it('scrubs forward again and restores the later checkpoint', () => {
    const tabA = { ...createTab(), tabId: 'tab-a' };
    const tabB = { ...createTab(), tabId: 'tab-b' };

    startRecording();
    record(
      {
        type: loadRequest.type,
        payload: { req: sampleRequest(), activate: true }
      },
      getStateWithTabs([tabA], 'tab-a')
    );
    record({ type: newTab.type }, getStateWithTabs([tabA, tabB], 'tab-b'));
    stopRecording();

    seekRecordingTo(0, { dispatch: vi.fn() as unknown as AppDispatch });
    const dispatch = vi.fn();
    const playhead = seekRecordingTo(1, { dispatch: dispatch as unknown as AppDispatch });

    expect(playhead).toBe(1);
    expect(getSessionEvents()).toHaveLength(2);
    expect(dispatch).toHaveBeenCalledWith(
      restoreTabsState({
        tabs: [tabA, tabB],
        activeTabId: 'tab-b'
      })
    );
  });

  it('is a no-op while recording is active', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    record({ type: newTab.type });
    getWorkflowLogApi().flush();

    const dispatch = vi.fn();
    const tip = seekRecordingTo(0, { dispatch: dispatch as unknown as AppDispatch });

    expect(tip).toBe(1);
    expect(getSessionEvents()).toHaveLength(2);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not restore when already at the tip after pause', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    record({ type: newTab.type });
    stopRecording();

    const dispatch = vi.fn();
    const tip = seekRecordingTo(1, { dispatch: dispatch as unknown as AppDispatch });

    expect(tip).toBe(1);
    expect(getSessionEvents()).toHaveLength(2);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('keeps full elapsed time while scrubbing so the timeline stays intact', () => {
    startRecording();
    vi.advanceTimersByTime(1_000);
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    vi.advanceTimersByTime(500);
    record({ type: newTab.type });
    stopRecording();
    expect(getRecordingElapsedMs()).toBe(1_500);

    seekRecordingTo(0, { dispatch: vi.fn() as unknown as AppDispatch });
    expect(getRecordingElapsedMs()).toBe(1_500);
  });

  it('truncates later actions when resuming from a mid-timeline playhead', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    record({ type: newTab.type });
    stopRecording();

    seekRecordingTo(0, { dispatch: vi.fn() as unknown as AppDispatch });
    startRecording();
    expect(getSessionEvents().map((event) => event.type)).toEqual(['request.load']);
    expect(getRecordingElapsedMs()).toBe(0);

    record({ type: SEND_REQUEST_PENDING_TYPE, meta: { requestId: 'after-rewind' } });
    stopRecording();

    expect(getSessionEvents().map((event) => event.type)).toEqual(['request.load', 'request.send']);
  });
});

describe('replaceSessionActions', () => {
  it('replaces paused session events and preserves an intact uuid prefix', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    record({ type: newTab.type });
    record({ type: SEND_REQUEST_PENDING_TYPE, meta: { requestId: 'r1' } });
    stopRecording();

    const events = getSessionEvents();
    const reordered = [events[0]!, events[2]!, events[1]!];
    replaceSessionActions(reordered, emptyGetState);

    expect(getSessionEvents().map((event) => event.uuid)).toEqual([
      events[0]!.uuid,
      events[2]!.uuid,
      events[1]!.uuid
    ]);
  });

  it('is a no-op while recording is active', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    getWorkflowLogApi().flush();
    const before = getSessionEvents();
    replaceSessionActions([], emptyGetState);
    expect(getSessionEvents()).toEqual(before);
  });

  it('supports delete and payload update for the recording buffer', () => {
    startRecording();
    record({
      type: loadRequest.type,
      payload: { req: sampleRequest(), activate: true }
    });
    record({ type: newTab.type });
    stopRecording();

    const [first, second] = getSessionEvents();
    replaceSessionActions([first!], emptyGetState);
    expect(getSessionEvents()).toHaveLength(1);
    expect(getSessionEvents()[0]!.uuid).toBe(first!.uuid);

    replaceSessionActions([{ ...first!, payload: { edited: true } }], emptyGetState);
    expect(getSessionEvents()[0]!.payload).toEqual({ edited: true });
    expect(second).toBeDefined();
  });

  it('records browser tab open and chrome navigation intents', () => {
    const browserTab = createBrowserTab({
      tabId: 'browser-1',
      url: 'about:blank',
      homeUrl: 'https://example.com'
    });
    const getBrowserState = (): RootState =>
      ({
        ...emptyGetState(),
        tabs: { tabs: [browserTab], activeTabId: browserTab.tabId }
      }) as unknown as RootState;

    startRecording();
    record({ type: newBrowserTab.type }, getBrowserState);
    record(
      {
        type: browserNavigate.type,
        payload: { tabId: 'browser-1', url: 'https://example.com/page' }
      },
      getBrowserState
    );
    record({ type: browserGoBack.type, payload: { tabId: 'browser-1' } }, getBrowserState);
    record({ type: browserGoForward.type, payload: { tabId: 'browser-1' } }, getBrowserState);
    record({ type: browserReload.type, payload: { tabId: 'browser-1' } }, getBrowserState);
    record({ type: browserGoHome.type, payload: { tabId: 'browser-1' } }, getBrowserState);
    stopRecording();

    const events = getSessionEvents();
    expect(events.map((entry) => entry.type)).toEqual([
      'browser.tab.new',
      'browser.navigate',
      'browser.back',
      'browser.forward',
      'browser.reload',
      'browser.home'
    ]);
    expect(events[0]?.payload).toEqual({
      tabId: 'browser-1',
      url: 'about:blank',
      homeUrl: 'https://example.com'
    });
    expect(events[1]?.payload).toEqual({
      tabId: 'browser-1',
      url: 'https://example.com/page'
    });
    expect(events[2]?.payload).toEqual({ tabId: 'browser-1' });
  });
});
