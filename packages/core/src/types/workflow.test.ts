import { describe, expect, it } from 'vitest';
import { defaultAuth } from '../auth';
import {
  buildWorkflowExport,
  buildWorkflowRunExport,
  buildWorkflowRunRequestResult,
  normalizeWorkflowDelayMs,
  validateWorkflowExport
} from './workflow';

describe('normalizeWorkflowDelayMs', () => {
  it('floors finite non-negative numbers', () => {
    expect(normalizeWorkflowDelayMs(250.9)).toBe(250);
    expect(normalizeWorkflowDelayMs(0)).toBe(0);
  });

  it('maps invalid values to 0', () => {
    expect(normalizeWorkflowDelayMs(-1)).toBe(0);
    expect(normalizeWorkflowDelayMs(Number.NaN)).toBe(0);
    expect(normalizeWorkflowDelayMs(undefined)).toBe(0);
    expect(normalizeWorkflowDelayMs('nope')).toBe(0);
  });
});

describe('buildWorkflowExport', () => {
  it('builds a portable workflow envelope with defaults', () => {
    const envelope = buildWorkflowExport({
      uuid: 'wf-1',
      name: 'Morning checks',
      actions: [{ uuid: 'action-1', type: 'request.load', at: 100, payload: { uuid: 'req-1' } }]
    });

    expect(envelope).toEqual({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-1',
      name: 'Morning checks',
      variables: {},
      actions: [{ uuid: 'action-1', type: 'request.load', at: 100, payload: { uuid: 'req-1' } }]
    });
  });

  it('includes duration, delay, and variables when provided', () => {
    const envelope = buildWorkflowExport({
      uuid: 'wf-2',
      name: 'With vars',
      variables: { env: 'qa' },
      durationMs: 12_500,
      delayMs: 250,
      actions: [{ uuid: 'action-2', type: 'environment.setActive', payload: { id: 3 } }]
    });

    expect(envelope.variables).toEqual({ env: 'qa' });
    expect(envelope.durationMs).toBe(12_500);
    expect(envelope.delayMs).toBe(250);
  });
});

describe('buildWorkflowRunRequestResult', () => {
  it('maps send outcome fields into the workflow-run request shape', () => {
    const entry = buildWorkflowRunRequestResult({
      name: 'My request',
      uuid: 'req-uuid',
      method: 'POST',
      url: 'https://example.com/api',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      cookies: [{ key: 'session', value: 'abc', enabled: true }],
      tags: 'alpha, beta',
      comment: 'note',
      body: '{"ok":true}',
      authorization: defaultAuth(),
      responseBody: '{"id":1}',
      status: 200,
      statusText: 'OK',
      responseHeaders: { 'content-type': 'application/json' },
      timeMs: 42,
      sizeBytes: 8,
      timing: { waitingMs: 20, downloadMs: 5 },
      tests: [{ name: 'status is 200', passed: true }],
      data: { token: 'xyz' }
    });

    expect(entry).toEqual({
      name: 'My request',
      uuid: 'req-uuid',
      method: 'POST',
      url: 'https://example.com/api',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      cookies: [{ key: 'session', value: 'abc', enabled: true }],
      notes: { tags: ['alpha', 'beta'], comment: 'note' },
      body: '{"ok":true}',
      authorization: defaultAuth(),
      response: {
        status: 200,
        statusText: 'OK',
        body: '{"id":1}',
        headers: [{ key: 'content-type', value: 'application/json', enabled: true }],
        timing: { totalTime: 42, size: 8, waitingMs: 20, downloadMs: 5 },
        tests: [{ name: 'status is 200', passed: true }],
        data: { token: 'xyz' },
        scriptLogs: [],
        executionEvents: []
      }
    });
  });

  it('persists script console logs and execution events when provided', () => {
    const entry = buildWorkflowRunRequestResult({
      name: 'Logged request',
      uuid: '',
      method: 'GET',
      url: 'https://example.com',
      headers: [],
      cookies: [],
      tags: '',
      comment: '',
      body: '',
      authorization: defaultAuth(),
      responseBody: '',
      status: 200,
      statusText: 'OK',
      responseHeaders: {},
      timeMs: 1,
      tests: [],
      data: {},
      scriptLogs: [{ message: 'pre: hello', level: 'log', method: 'log', scriptName: 'Pre' }],
      executionEvents: [
        { type: 'variable', scope: 'environment', action: 'set', key: 'a', value: '1' }
      ],
      scriptError: 'post: boom',
      scriptErrors: [{ message: 'boom', scriptName: 'post', phase: 'post' }]
    });

    expect(entry.response.scriptLogs).toEqual([
      { message: 'pre: hello', level: 'log', method: 'log', scriptName: 'Pre' }
    ]);
    expect(entry.response.executionEvents).toEqual([
      { type: 'variable', scope: 'environment', action: 'set', key: 'a', value: '1' }
    ]);
    expect(entry.response.scriptError).toBe('post: boom');
    expect(entry.response.scriptErrors).toEqual([
      { message: 'boom', scriptName: 'post', phase: 'post' }
    ]);
  });
});

describe('buildWorkflowRunExport', () => {
  it('builds a workflow-run envelope with defaults', () => {
    const envelope = buildWorkflowRunExport({
      name: 'Morning checks',
      actions: [
        {
          index: 1,
          ranAt: '2026-07-28T12:00:00.000Z',
          durationMs: 10,
          result: { target: 'active' }
        }
      ]
    });

    expect(envelope.harborclientVersion).toBe(1);
    expect(envelope.harborclientExport).toBe('workflow-run');
    expect(envelope.name).toBe('Morning checks');
    expect(envelope.environment).toBe('');
    expect(typeof envelope.date_created).toBe('string');
    expect(envelope.actions).toEqual([
      {
        index: 1,
        ranAt: '2026-07-28T12:00:00.000Z',
        durationMs: 10,
        result: { target: 'active' }
      }
    ]);
  });

  it('preserves environment and date when provided', () => {
    const envelope = buildWorkflowRunExport({
      name: 'Run',
      environment: 'env-uuid',
      date_created: '2026-07-28T12:00:00.000Z',
      actions: []
    });

    expect(envelope.environment).toBe('env-uuid');
    expect(envelope.date_created).toBe('2026-07-28T12:00:00.000Z');
  });
});

describe('validateWorkflowExport', () => {
  it('accepts a valid workflow export', () => {
    const exportData = validateWorkflowExport({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-3',
      name: 'Valid',
      variables: {},
      actions: [{ uuid: 'action-3', type: 'tabs.openPage', payload: { page: 'settings' } }],
      durationMs: 1000
    });

    expect(exportData.harborclientExport).toBe('workflow');
    expect(exportData.actions).toHaveLength(1);
  });

  it('defaults missing variables to an empty object', () => {
    const exportData = validateWorkflowExport({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-4',
      name: 'No vars',
      actions: []
    });

    expect(exportData.variables).toEqual({});
  });

  it('accepts an optional delayMs', () => {
    const exportData = validateWorkflowExport({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-4b',
      name: 'With delay',
      actions: [],
      delayMs: 500
    });

    expect(exportData.delayMs).toBe(500);
  });

  it('rejects unknown export kinds', () => {
    expect(() =>
      validateWorkflowExport({
        harborclientVersion: 1,
        harborclientExport: 'workspace',
        uuid: 'wf-5',
        name: 'Wrong kind',
        actions: []
      })
    ).toThrow();
  });

  it('rejects empty action types', () => {
    expect(() =>
      validateWorkflowExport({
        harborclientVersion: 1,
        harborclientExport: 'workflow',
        uuid: 'wf-6',
        name: 'Bad action',
        actions: [{ uuid: 'action-6', type: '  ', payload: {} }]
      })
    ).toThrow();
  });

  it('rejects actions missing uuid', () => {
    expect(() =>
      validateWorkflowExport({
        harborclientVersion: 1,
        harborclientExport: 'workflow',
        uuid: 'wf-7',
        name: 'Missing action uuid',
        actions: [{ type: 'request.send', payload: { target: 'active' } }]
      })
    ).toThrow();
  });
});
