import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { SavedRequest } from '@harborclient/core/types';
import {
  clearSession,
  getRecordingElapsedMs,
  getWorkflowLogApi,
  isRecording,
  processWorkflowAction,
  resetWorkflowRecorderForTests,
  startRecording,
  stopRecording
} from './workflowRecorder';

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
    processWorkflowAction({
      type: 'tabs/loadRequest',
      payload: { req: sampleRequest(), activate: true }
    });
    expect(getWorkflowLogApi().events).toEqual([]);
  });

  it('ignores actions that are not in the registry', () => {
    startRecording();
    processWorkflowAction({ type: 'tabs/updateTab', payload: { tabId: 'x', updates: {} } });
    getWorkflowLogApi().flush();
    expect(getWorkflowLogApi().events).toEqual([]);
  });

  it('records load, coalesced drafts, and send in order', () => {
    startRecording();
    processWorkflowAction({
      type: 'tabs/loadRequest',
      payload: { req: sampleRequest(), activate: true }
    });
    processWorkflowAction({
      type: 'tabs/setActiveDraft',
      payload: sampleDraft({
        url: 'https://example.com/things?a=1',
        headers: [{ key: 'X-Test', value: '1', enabled: true }]
      })
    });
    processWorkflowAction({
      type: 'tabs/setActiveDraft',
      payload: sampleDraft({
        url: 'https://example.com/things?a=2',
        headers: [{ key: 'X-Test', value: '2', enabled: true }]
      })
    });
    processWorkflowAction({
      type: 'tabs/sendRequest/pending',
      meta: { requestId: 'r1', arg: undefined }
    });

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
    expect(events[2]?.payload).toEqual({ target: 'active' });
  });

  it('appends across stop and start cycles', () => {
    startRecording();
    processWorkflowAction({
      type: 'tabs/loadRequest',
      payload: { req: sampleRequest(), activate: true }
    });
    stopRecording();
    processWorkflowAction({
      type: 'tabs/sendRequest/pending',
      meta: { requestId: 'r1' }
    });
    startRecording();
    processWorkflowAction({
      type: 'tabs/sendRequest/pending',
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
    processWorkflowAction({ type: 'tabs/sendRequest/pending', meta: { requestId: 'r1' } });
    vi.advanceTimersByTime(1_000);
    const api = getWorkflowLogApi();
    expect(api.events).toHaveLength(1);
    clearSession();
    expect(api.events).toEqual([]);
    expect(getRecordingElapsedMs()).toBe(0);
    expect(isRecording()).toBe(false);
  });
});
