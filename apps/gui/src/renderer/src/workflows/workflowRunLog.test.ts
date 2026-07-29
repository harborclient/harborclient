import { afterEach, describe, expect, it } from 'vitest';
import {
  beginWorkflowRunLog,
  clearWorkflowRunLog,
  getWorkflowRunLog,
  getWorkflowRunLogMeta,
  loadWorkflowRunLogFromHistory,
  resetWorkflowRunLogForTests
} from './workflowRunLog';

describe('loadWorkflowRunLogFromHistory', () => {
  afterEach(() => {
    resetWorkflowRunLogForTests();
  });

  it('replaces the in-memory log with persisted history steps', () => {
    beginWorkflowRunLog({
      workflowUuid: 'current',
      name: 'Current',
      environment: '',
      date_created: '2026-07-29T10:00:00.000Z'
    });
    expect(getWorkflowRunLogMeta()?.workflowUuid).toBe('current');

    loadWorkflowRunLogFromHistory({
      workflowUuid: 'historic',
      name: 'Historic run',
      environment: 'env-1',
      date_created: '2026-07-28T09:00:00.000Z',
      steps: [
        {
          action: { uuid: 'step-1', type: 'wait', at: 0, payload: { ms: 10 } },
          result: { waited: true },
          ranAt: '2026-07-28T09:00:00.100Z',
          durationMs: 10
        }
      ]
    });

    expect(getWorkflowRunLogMeta()).toEqual({
      workflowUuid: 'historic',
      name: 'Historic run',
      environment: 'env-1',
      date_created: '2026-07-28T09:00:00.000Z'
    });
    expect(getWorkflowRunLog()).toHaveLength(1);
    expect(getWorkflowRunLog()[0]?.action.uuid).toBe('step-1');
    expect(getWorkflowRunLog()[0]?.result).toEqual({ waited: true });
  });

  it('can clear after hydrating a historic run', () => {
    loadWorkflowRunLogFromHistory({
      workflowUuid: 'historic',
      name: 'Historic run',
      environment: '',
      date_created: '2026-07-28T09:00:00.000Z',
      steps: []
    });
    clearWorkflowRunLog();
    expect(getWorkflowRunLogMeta()).toBeNull();
    expect(getWorkflowRunLog()).toEqual([]);
  });
});
