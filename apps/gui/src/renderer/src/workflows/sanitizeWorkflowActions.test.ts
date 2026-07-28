import { describe, expect, it, vi } from 'vitest';
import { sanitizeWorkflowActions } from './sanitizeWorkflowActions';
import { formatWorkflowDuration } from './formatWorkflowDuration';

describe('sanitizeWorkflowActions', () => {
  it('strips empty header and param placeholders from draft payloads', () => {
    const actions = sanitizeWorkflowActions([
      {
        uuid: 'action-draft-1',
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

    expect(actions[0]?.uuid).toBe('action-draft-1');
    expect(actions[0]?.payload).toEqual({
      headers: [{ key: 'Accept', value: 'json', enabled: true }],
      params: []
    });
  });

  it('preserves existing action uuids', () => {
    const actions = sanitizeWorkflowActions([
      { uuid: 'keep-me', type: 'request.send', at: 10, payload: { target: 'active' } }
    ]);

    expect(actions[0]).toEqual({
      uuid: 'keep-me',
      type: 'request.send',
      at: 10,
      payload: { target: 'active' }
    });
  });

  it('mints a uuid when an action is missing one', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000001'
    );

    const actions = sanitizeWorkflowActions([
      { type: 'request.send', at: 10, payload: { target: 'active' } } as never
    ]);

    expect(actions[0]?.uuid).toBe('00000000-0000-4000-8000-000000000001');
    vi.restoreAllMocks();
  });
});

describe('formatWorkflowDuration', () => {
  it('formats seconds and hours', () => {
    expect(formatWorkflowDuration(5_000)).toBe('0:05');
    expect(formatWorkflowDuration(65_000)).toBe('1:05');
    expect(formatWorkflowDuration(3_665_000)).toBe('1:01:05');
  });
});
