import { describe, expect, it } from 'vitest';
import {
  formatFlowExecutionDetail,
  formatFlowExecutionLabel,
  formatVariableExecutionDetail,
  formatVariableExecutionLabel
} from '#/renderer/src/ui/Shared/ConsoleDetails/executionEventLabels';

describe('executionEventLabels', () => {
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
      formatFlowExecutionDetail({
        type: 'flow',
        action: 'set-next-request',
        nextRequest: 'Login'
      })
    ).toBe('Login');
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
});
