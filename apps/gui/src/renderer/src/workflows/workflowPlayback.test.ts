import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { SavedRequest, WorkflowAction } from '@harborclient/core/types';
import type { RequestDraft } from '#/renderer/src/store/tabs';
import { emptyKeyValue } from '#/renderer/src/store/tabs';
import { loadRequest } from '#/renderer/src/store/slices/tabsSlice';
import {
  clearPlayback,
  getPlaybackActions,
  getPlaybackElapsedMs,
  getPlaybackIndex,
  isPlaybackGapless,
  isPlaying,
  loadPlayback,
  replacePlaybackActions,
  resetWorkflowPlaybackForTests,
  restartPlayback,
  seekPlaybackTo,
  setPlaybackGapless,
  startPlayback,
  stepPlaybackCursor,
  stopPlayback
} from './workflowPlayback';
import { getWorkflowRunLog, getWorkflowRunLogMeta } from './workflowRunLog';
import { mergeWorkflowDraftPayload } from './workflowPlaybackHelpers';
import {
  getSessionEvents,
  isWorkflowRecordingMuted,
  processWorkflowAction,
  resetWorkflowRecorderForTests,
  startRecording
} from './workflowRecorder';

/**
 * Builds a workflow action fixture with a stable uuid for playback tests.
 *
 * @param type - Logical event type.
 * @param payload - Action payload.
 * @param at - Optional wall-clock timestamp.
 * @returns Workflow action with a deterministic uuid.
 */
function a(type: string, payload: unknown, at?: number): WorkflowAction {
  const uuid =
    at != null
      ? `pb-${type}-${at}-${JSON.stringify(payload)}`
      : `pb-${type}-${JSON.stringify(payload)}`;
  return { uuid, type, ...(at != null ? { at } : {}), payload };
}

/**
 * Builds a minimal saved request for recording mute tests.
 *
 * @returns Saved request fixture.
 */
function sampleRequest(): SavedRequest {
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
    updated_at: ''
  };
}

describe('workflowPlayback cursor', () => {
  beforeEach(() => {
    resetWorkflowPlaybackForTests();
    resetWorkflowRecorderForTests();
  });

  afterEach(() => {
    resetWorkflowPlaybackForTests();
    resetWorkflowRecorderForTests();
    vi.unstubAllGlobals();
  });

  it('clamps rewind and fast-forward without dispatching', () => {
    const dispatch = vi.fn();
    loadPlayback([
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 2 }),
      a('environment.activate', { environmentId: 3 })
    ]);

    expect(getPlaybackIndex()).toBe(0);
    stepPlaybackCursor(-1);
    expect(getPlaybackIndex()).toBe(0);
    stepPlaybackCursor(1);
    expect(getPlaybackIndex()).toBe(1);
    stepPlaybackCursor(10);
    expect(getPlaybackIndex()).toBe(3);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('replacePlaybackActions updates actions and cursor without clearing elapsed time', () => {
    loadPlayback([
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 2 }),
      a('environment.activate', { environmentId: 3 })
    ]);
    seekPlaybackTo(2);
    const elapsedBefore = getPlaybackElapsedMs();

    replacePlaybackActions(
      [
        a('environment.activate', { environmentId: 2 }),
        a('environment.activate', { environmentId: 1 }),
        a('environment.activate', { environmentId: 3 })
      ],
      1
    );

    expect(getPlaybackIndex()).toBe(1);
    expect(getPlaybackActions()).toEqual([
      a('environment.activate', { environmentId: 2 }),
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 3 })
    ]);
    expect(getPlaybackElapsedMs()).toBe(elapsedBefore);
  });

  it('replacePlaybackActions clamps the cursor when actions shrink', () => {
    loadPlayback([
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 2 })
    ]);
    seekPlaybackTo(2);
    replacePlaybackActions([a('environment.activate', { environmentId: 1 })]);
    expect(getPlaybackIndex()).toBe(1);
  });

  it('restart resets cursor and elapsed time', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const dispatch = vi.fn((action: unknown) => {
      if (typeof action === 'function') {
        const promise = gate.then(() => undefined);
        return Object.assign(promise, { unwrap: () => gate });
      }
      return action;
    });

    loadPlayback([
      a('request.send', { target: 'active' }),
      a('environment.activate', { environmentId: 2 })
    ]);

    const playPromise = startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    await Promise.resolve();
    expect(isPlaying()).toBe(true);
    stopPlayback();
    expect(getPlaybackElapsedMs()).toBeGreaterThanOrEqual(0);
    release();
    await playPromise;

    restartPlayback();
    expect(getPlaybackIndex()).toBe(0);
    expect(getPlaybackElapsedMs()).toBe(0);
    expect(isPlaying()).toBe(false);
  });

  it('play invokes handlers in order and awaits each step', async () => {
    const order: number[] = [];
    const dispatch = vi.fn((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        const typed = action as { type: string; payload?: number | null };
        if (typed.type === 'environments/setActiveEnvironmentId') {
          order.push(typed.payload as number);
        }
      }
      return action;
    });

    loadPlayback([
      a('environment.activate', { environmentId: 10 }),
      a('environment.activate', { environmentId: 20 })
    ]);

    await startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    expect(order).toEqual([10, 20]);
    expect(getPlaybackIndex()).toBe(2);
    expect(isPlaying()).toBe(false);
  });

  it('stop mid-run leaves the cursor on the next unplayed action', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const dispatch = vi.fn((action: unknown) => {
      if (typeof action === 'function') {
        const promise = gate.then(() => undefined);
        return Object.assign(promise, { unwrap: () => gate });
      }
      return action;
    });

    loadPlayback([
      a('request.send', { target: 'active' }),
      a('environment.activate', { environmentId: 2 })
    ]);

    const playPromise = startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    await Promise.resolve();
    stopPlayback();
    release();
    await playPromise;

    expect(getPlaybackIndex()).toBe(0);
    expect(isPlaying()).toBe(false);
  });

  it('mutes recording while a playback session is loaded', () => {
    startRecording();
    loadPlayback([a('environment.activate', { environmentId: 1 })]);
    expect(isWorkflowRecordingMuted()).toBe(true);

    processWorkflowAction(loadRequest({ req: sampleRequest() }), () => ({}) as never);
    expect(getSessionEvents()).toHaveLength(0);

    clearPlayback();
    expect(isWorkflowRecordingMuted()).toBe(false);

    processWorkflowAction(loadRequest({ req: sampleRequest() }), () => ({}) as never);
    expect(getSessionEvents()).toHaveLength(1);
  });

  it('jumps to a workflow action uuid from script directives', async () => {
    const { noteWorkflowScriptDirectives } = await import('./workflowScriptContext');
    const actions = [
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 2 }),
      a('environment.activate', { environmentId: 3 })
    ];
    actions[0]!.uuid = 'act-0';
    actions[1]!.uuid = 'act-1';
    actions[2]!.uuid = 'act-2';

    const played: number[] = [];
    const dispatch = vi.fn((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        const typed = action as { type: string; payload?: number | null };
        if (typed.type === 'environments/setActiveEnvironmentId') {
          played.push(typed.payload as number);
          if (typed.payload === 1) {
            noteWorkflowScriptDirectives({ workflowNextAction: 'act-2' });
          }
        }
      }
      return action;
    });

    loadPlayback(actions, 'wf-uuid');
    await startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    expect(played).toEqual([1, 3]);
    expect(getPlaybackIndex()).toBe(3);
  });

  it('records run-log entries in exact jump execution order', async () => {
    const { noteWorkflowScriptDirectives } = await import('./workflowScriptContext');
    const actions = [
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 2 }),
      a('environment.activate', { environmentId: 3 })
    ];
    actions[0]!.uuid = 'act-0';
    actions[1]!.uuid = 'act-1';
    actions[2]!.uuid = 'act-2';

    const dispatch = vi.fn((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        const typed = action as { type: string; payload?: number | null };
        if (typed.type === 'environments/setActiveEnvironmentId' && typed.payload === 1) {
          noteWorkflowScriptDirectives({ workflowNextAction: 'act-2' });
        }
      }
      return action;
    });

    loadPlayback(actions, 'wf-uuid');
    await startPlayback({
      dispatch: dispatch as never,
      getState: () =>
        ({
          workflows: { items: [{ uuid: 'wf-uuid', name: 'Jump run' }] },
          environments: { activeEnvironmentId: null, environments: [] }
        }) as never
    });

    const log = getWorkflowRunLog();
    expect(getWorkflowRunLogMeta()?.name).toBe('Jump run');
    expect(log.map((entry) => entry.action.uuid)).toEqual(['act-0', 'act-2']);
    expect(log.map((entry) => entry.result)).toEqual([{ environmentId: 1 }, { environmentId: 3 }]);
  });

  it('auto-exports workflow results when a full run completes and a directory is set', async () => {
    const writeTextInDirectory = vi.fn(
      async (directory: string, fileName: string, content: string) => {
        void directory;
        void fileName;
        void content;
        return { path: '/tmp/out.json' };
      }
    );
    vi.stubGlobal('window', { api: { writeTextInDirectory } });

    const dispatch = vi.fn((action: unknown) => action);
    loadPlayback([a('environment.activate', { environmentId: 1 })], 'wf-export');

    await startPlayback({
      dispatch: dispatch as never,
      getState: () =>
        ({
          workflows: { items: [{ uuid: 'wf-export', name: 'Export me' }] },
          environments: { activeEnvironmentId: null, environments: [] },
          settings: { general: { workflowResultsDirectory: '/tmp/workflow-results' } }
        }) as never
    });

    expect(writeTextInDirectory).toHaveBeenCalledTimes(1);
    expect(writeTextInDirectory.mock.calls[0]![0]).toBe('/tmp/workflow-results');
    vi.unstubAllGlobals();
  });

  it('does not auto-export when the run is stopped early', async () => {
    const writeTextInDirectory = vi.fn(async () => ({ path: '/tmp/out.json' }));
    vi.stubGlobal('window', { api: { writeTextInDirectory } });

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const dispatch = vi.fn((action: unknown) => {
      if (typeof action === 'function') {
        const promise = gate.then(() => undefined);
        return Object.assign(promise, { unwrap: () => gate });
      }
      return action;
    });

    loadPlayback(
      [a('request.send', { target: 'active' }), a('environment.activate', { environmentId: 2 })],
      'wf-stop'
    );

    const playPromise = startPlayback({
      dispatch: dispatch as never,
      getState: () =>
        ({
          workflows: { items: [{ uuid: 'wf-stop', name: 'Stop me' }] },
          environments: { activeEnvironmentId: null, environments: [] },
          settings: { general: { workflowResultsDirectory: '/tmp/workflow-results' } }
        }) as never
    });

    await Promise.resolve();
    stopPlayback();
    release();
    await playPromise;

    expect(writeTextInDirectory).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('falls forward when workflowNextAction uuid is unknown', async () => {
    const { noteWorkflowScriptDirectives } = await import('./workflowScriptContext');
    const actions = [
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 2 })
    ];
    actions[0]!.uuid = 'act-0';
    actions[1]!.uuid = 'act-1';

    const played: number[] = [];
    const dispatch = vi.fn((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        const typed = action as { type: string; payload?: number | null };
        if (typed.type === 'environments/setActiveEnvironmentId') {
          played.push(typed.payload as number);
          if (typed.payload === 1) {
            noteWorkflowScriptDirectives({ workflowNextAction: 'missing' });
          }
        }
      }
      return action;
    });

    loadPlayback(actions, 'wf-uuid');
    await startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    expect(played).toEqual([1, 2]);
    expect(getPlaybackIndex()).toBe(2);
  });

  it('seekPlaybackTo clamps and does not dispatch', () => {
    const dispatch = vi.fn();
    loadPlayback([
      a('environment.activate', { environmentId: 1 }),
      a('environment.activate', { environmentId: 2 }),
      a('environment.activate', { environmentId: 3 })
    ]);

    seekPlaybackTo(2);
    expect(getPlaybackIndex()).toBe(2);
    seekPlaybackTo(-5);
    expect(getPlaybackIndex()).toBe(0);
    seekPlaybackTo(99);
    expect(getPlaybackIndex()).toBe(3);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('seekPlaybackTo is a no-op while playing', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const dispatch = vi.fn((action: unknown) => {
      if (typeof action === 'function') {
        const promise = gate.then(() => undefined);
        return Object.assign(promise, { unwrap: () => gate });
      }
      return action;
    });

    loadPlayback([
      a('request.send', { target: 'active' }),
      a('environment.activate', { environmentId: 2 })
    ]);

    const playPromise = startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    await Promise.resolve();
    seekPlaybackTo(1);
    expect(getPlaybackIndex()).toBe(0);

    stopPlayback();
    release();
    await playPromise;
  });

  it('defaults to gapless and waits recorded gaps when gapless is off', async () => {
    vi.useFakeTimers();
    expect(isPlaybackGapless()).toBe(true);
    setPlaybackGapless(false);
    expect(isPlaybackGapless()).toBe(false);

    const order: number[] = [];
    const dispatch = vi.fn((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        const typed = action as { type: string; payload?: number | null };
        if (typed.type === 'environments/setActiveEnvironmentId') {
          order.push(typed.payload as number);
        }
      }
      return action;
    });

    const t0 = 1_000_000;
    loadPlayback([
      a('environment.activate', { environmentId: 1 }, t0),
      a('environment.activate', { environmentId: 2 }, t0 + 500)
    ]);

    const playPromise = startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(499);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(1);
    await playPromise;

    expect(order).toEqual([1, 2]);
    expect(isPlaying()).toBe(false);
    vi.useRealTimers();
  });

  it('stop cancels a pending gapped wait', async () => {
    vi.useFakeTimers();
    setPlaybackGapless(false);

    const order: number[] = [];
    const dispatch = vi.fn((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        const typed = action as { type: string; payload?: number | null };
        if (typed.type === 'environments/setActiveEnvironmentId') {
          order.push(typed.payload as number);
        }
      }
      return action;
    });

    const t0 = 2_000_000;
    loadPlayback([
      a('environment.activate', { environmentId: 1 }, t0),
      a('environment.activate', { environmentId: 2 }, t0 + 5_000)
    ]);

    const playPromise = startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);

    stopPlayback();
    await vi.advanceTimersByTimeAsync(5_000);
    await playPromise;

    expect(order).toEqual([1]);
    expect(getPlaybackIndex()).toBe(1);
    expect(isPlaying()).toBe(false);
    vi.useRealTimers();
  });

  it('waits delayMs between completed steps', async () => {
    vi.useFakeTimers();

    const order: number[] = [];
    const dispatch = vi.fn((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        const typed = action as { type: string; payload?: number | null };
        if (typed.type === 'environments/setActiveEnvironmentId') {
          order.push(typed.payload as number);
        }
      }
      return action;
    });

    loadPlayback(
      [
        a('environment.activate', { environmentId: 1 }),
        a('environment.activate', { environmentId: 2 })
      ],
      '',
      200
    );

    const playPromise = startPlayback({
      dispatch: dispatch as never,
      getState: () => ({}) as never
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(199);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(1);
    await playPromise;

    expect(order).toEqual([1, 2]);
    expect(isPlaying()).toBe(false);
    vi.useRealTimers();
  });
});

describe('mergeWorkflowDraftPayload', () => {
  /**
   * Builds a minimal request draft for merge tests.
   *
   * @returns Request draft fixture.
   */
  function baseDraft(): RequestDraft {
    return {
      name: 'Old',
      method: 'GET',
      url: 'https://example.com',
      headers: [emptyKeyValue()],
      params: [emptyKeyValue()],
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
    };
  }

  it('maps camelCase payload fields onto the active draft', () => {
    const merged = mergeWorkflowDraftPayload(baseDraft(), {
      name: 'New',
      method: 'POST',
      url: 'https://example.com/v2',
      bodyType: 'json',
      body: '{"a":1}',
      collectionId: 5,
      folderId: 9,
      headers: [{ key: 'X', value: '1', enabled: true }]
    });

    expect(merged.name).toBe('New');
    expect(merged.method).toBe('POST');
    expect(merged.body_type).toBe('json');
    expect(merged.body).toBe('{"a":1}');
    expect(merged.collection_id).toBe(5);
    expect(merged.folder_id).toBe(9);
    expect(merged.headers).toEqual([{ key: 'X', value: '1', enabled: true }]);
  });
});
