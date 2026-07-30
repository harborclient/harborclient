import { describe, expect, it } from 'vitest';
import { buildScriptRunInfo, scriptEventNameFromPhase } from './script';

describe('buildScriptRunInfo', () => {
  it('maps pre phase to prerequest and post phase to test', () => {
    expect(scriptEventNameFromPhase('pre')).toBe('prerequest');
    expect(scriptEventNameFromPhase('post')).toBe('test');
  });

  it('stringifies saved request ids and trims request names', () => {
    expect(
      buildScriptRunInfo('pre', {
        requestName: '  Health check  ',
        requestId: 7,
        iteration: 2
      })
    ).toEqual({
      eventName: 'prerequest',
      requestName: 'Health check',
      requestId: '7',
      iteration: 2,
      workflowId: '',
      workflowActionId: '',
      workflowActionIteration: -1,
      livepageId: ''
    });
  });

  it('uses empty requestId for unsaved requests and defaults iteration to 0', () => {
    expect(buildScriptRunInfo('post', { requestName: 'Draft', requestId: null })).toEqual({
      eventName: 'test',
      requestName: 'Draft',
      requestId: '',
      iteration: 0,
      workflowId: '',
      workflowActionId: '',
      workflowActionIteration: -1,
      livepageId: ''
    });
  });

  it('includes workflow context when provided', () => {
    expect(
      buildScriptRunInfo('pre', {
        requestName: 'Send',
        workflowId: 'wf-uuid',
        workflowActionId: 'action-uuid',
        workflowActionIteration: 3
      })
    ).toEqual({
      eventName: 'prerequest',
      requestName: 'Send',
      requestId: '',
      iteration: 0,
      workflowId: 'wf-uuid',
      workflowActionId: 'action-uuid',
      workflowActionIteration: 3,
      livepageId: ''
    });
  });

  it('includes livepageId when provided', () => {
    expect(
      buildScriptRunInfo('pre', {
        livepageId: '  live-page-uuid  '
      })
    ).toEqual({
      eventName: 'prerequest',
      requestName: '',
      requestId: '',
      iteration: 0,
      workflowId: '',
      workflowActionId: '',
      workflowActionIteration: -1,
      livepageId: 'live-page-uuid'
    });
  });
});
