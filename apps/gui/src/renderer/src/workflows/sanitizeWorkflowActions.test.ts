import { describe, expect, it } from 'vitest';
import { sanitizeWorkflowActions } from './sanitizeWorkflowActions';
import { formatWorkflowDuration } from './formatWorkflowDuration';

describe('sanitizeWorkflowActions', () => {
  it('strips empty header and param placeholders from draft payloads', () => {
    const actions = sanitizeWorkflowActions([
      {
        type: 'request.draft',
        at: 1,
        payload: {
          headers: [
            { key: 'Accept', value: 'json', enabled: true },
            { key: '', value: '', enabled: true }
          ],
          params: [{ key: '', value: '', enabled: true }]
        }
      }
    ]);

    expect(actions[0]?.payload).toEqual({
      headers: [{ key: 'Accept', value: 'json', enabled: true }],
      params: []
    });
  });
});

describe('formatWorkflowDuration', () => {
  it('formats seconds and hours', () => {
    expect(formatWorkflowDuration(5_000)).toBe('0:05');
    expect(formatWorkflowDuration(65_000)).toBe('1:05');
    expect(formatWorkflowDuration(3_665_000)).toBe('1:01:05');
  });
});
