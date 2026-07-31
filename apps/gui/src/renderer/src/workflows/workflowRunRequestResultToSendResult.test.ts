import { defaultAuth } from '@harborclient/core/auth';
import {
  buildWorkflowRunRequestResult,
  type WorkflowRunRequestResult
} from '@harborclient/core/types';
import { describe, expect, it } from 'vitest';
import { workflowRunRequestResultToEditorModel } from './workflowRunRequestResultToSendResult';

/**
 * Builds a minimal portable request result for adapter tests.
 *
 * @param overrides - Partial response fields to merge onto defaults.
 * @returns Portable request result.
 */
function buildResult(
  overrides: {
    responseBody?: string;
    responseHeaders?: Record<string, string>;
    scriptLogs?: import('@harborclient/core/types').ScriptLogEntry[];
    scriptError?: string;
  } = {}
): WorkflowRunRequestResult {
  return buildWorkflowRunRequestResult({
    name: 'Echo',
    uuid: 'req-1',
    method: 'GET',
    url: 'https://echo.example/get',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    cookies: [],
    tags: '',
    comment: '',
    body: '',
    authorization: defaultAuth(),
    responseBody: overrides.responseBody ?? '{"ok":true}',
    status: 200,
    statusText: 'OK',
    responseHeaders: overrides.responseHeaders ?? { 'content-type': 'application/json' },
    timeMs: 38,
    sizeBytes: 634,
    timing: { waitingMs: 20, downloadMs: 5 },
    tests: [{ name: 'status is 200', passed: true }],
    data: {},
    scriptLogs: overrides.scriptLogs,
    scriptError: overrides.scriptError
  });
}

describe('workflowRunRequestResultToEditorModel', () => {
  it('maps portable response fields into a SendResult for the Response Editor', () => {
    const model = workflowRunRequestResultToEditorModel(
      buildResult({
        scriptLogs: [{ message: 'hello', level: 'log', method: 'log', scriptName: 'Script' }],
        scriptError: 'oops'
      })
    );

    expect(model.requestUrl).toBe('https://echo.example/get');
    expect(model.testResults).toEqual([{ name: 'status is 200', passed: true }]);
    expect(model.scriptLogs).toEqual([
      { message: 'hello', level: 'log', method: 'log', scriptName: 'Script' }
    ]);
    expect(model.scriptError).toBe('oops');
    expect(model.response).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: '{"ok":true}',
      headers: { 'content-type': 'application/json' },
      timeMs: 38,
      sizeBytes: 634,
      timing: { waitingMs: 20, downloadMs: 5 }
    });
    expect(model.response.bodyBase64).toBeUndefined();
  });

  it('exposes image bodies as bodyBase64 for Preview', () => {
    const model = workflowRunRequestResultToEditorModel(
      buildResult({
        responseBody: 'iVBORw0KGgo=',
        responseHeaders: { 'content-type': 'image/png' }
      })
    );

    expect(model.response.body).toBe('');
    expect(model.response.bodyBase64).toBe('iVBORw0KGgo=');
  });
});
