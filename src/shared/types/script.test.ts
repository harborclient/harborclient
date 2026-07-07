import { describe, expect, it } from 'vitest';
import { buildScriptRunInfo, scriptEventNameFromPhase } from '#/shared/types/script';

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
      iteration: 2
    });
  });

  it('uses empty requestId for unsaved requests and defaults iteration to 0', () => {
    expect(buildScriptRunInfo('post', { requestName: 'Draft', requestId: null })).toEqual({
      eventName: 'test',
      requestName: 'Draft',
      requestId: '',
      iteration: 0
    });
  });
});
