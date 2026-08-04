import { describe, expect, it } from 'vitest';
import {
  formatExecutionEventLogMessage,
  formatFlowExecutionDetail,
  formatFlowExecutionLabel,
  formatVariableExecutionDetail,
  formatVariableExecutionLabel
} from './executionEventFormat';

describe('executionEventFormat', () => {
  it('formats variable set, update, and clear labels', () => {
    expect(
      formatVariableExecutionLabel({
        type: 'variable',
        scope: 'collection',
        action: 'set',
        key: 'token'
      })
    ).toBe('Set Collection variable');
    expect(
      formatVariableExecutionLabel({
        type: 'variable',
        scope: 'global',
        action: 'update',
        key: 'token'
      })
    ).toBe('Update Global variable');
    expect(
      formatVariableExecutionLabel({
        type: 'variable',
        scope: 'request',
        action: 'clear',
        key: 'token'
      })
    ).toBe('Clear Request variable');
  });

  it('formats flow labels and details', () => {
    expect(
      formatFlowExecutionLabel({
        type: 'flow',
        action: 'set-next-request',
        nextRequest: 'Login'
      })
    ).toBe('Set next request');
    expect(
      formatFlowExecutionLabel({
        type: 'flow',
        action: 'set-next-request',
        nextRequest: null
      })
    ).toBe('Stop collection run');
    expect(
      formatFlowExecutionLabel({
        type: 'flow',
        action: 'skip-request'
      })
    ).toBe('Skip request');
    expect(
      formatFlowExecutionLabel({
        type: 'flow',
        action: 'send-response',
        status: 400
      })
    ).toBe('Send response');
    expect(
      formatFlowExecutionDetail({
        type: 'flow',
        action: 'send-response',
        status: 400
      })
    ).toBe('400');
    expect(
      formatFlowExecutionLabel({
        type: 'flow',
        action: 'workflow-next-action',
        workflowNextAction: 'act-uuid'
      })
    ).toBe('Set next workflow action');
    expect(
      formatFlowExecutionLabel({
        type: 'flow',
        action: 'workflow-skip-action'
      })
    ).toBe('Skip workflow action');
    expect(
      formatFlowExecutionDetail({
        type: 'flow',
        action: 'set-next-request',
        nextRequest: 'Login'
      })
    ).toBe('Login');
    expect(
      formatFlowExecutionDetail({
        type: 'flow',
        action: 'workflow-next-action',
        workflowNextAction: 'act-uuid'
      })
    ).toBe('act-uuid');
  });

  it('formats variable details for set and clear actions', () => {
    expect(
      formatVariableExecutionDetail({
        type: 'variable',
        scope: 'environment',
        action: 'set',
        key: 'apiKey',
        value: 'secret'
      })
    ).toBe('apiKey = secret');
    expect(
      formatVariableExecutionDetail({
        type: 'variable',
        scope: 'request',
        action: 'clear',
        key: 'token'
      })
    ).toBe('token');
  });

  it('builds debug log messages with optional detail', () => {
    expect(
      formatExecutionEventLogMessage({
        type: 'variable',
        scope: 'request',
        action: 'set',
        key: 'token',
        value: 'abc'
      })
    ).toBe('Set Request variable - token = abc');
    expect(
      formatExecutionEventLogMessage({
        type: 'variable',
        scope: 'environment',
        action: 'clear',
        key: 'foo'
      })
    ).toBe('Clear Environment variable - foo');
    expect(
      formatExecutionEventLogMessage({
        type: 'flow',
        action: 'set-next-request',
        nextRequest: 'Login'
      })
    ).toBe('Set next request - Login');
    expect(
      formatExecutionEventLogMessage({
        type: 'flow',
        action: 'skip-request'
      })
    ).toBe('Skip request');
  });
});
