import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginWorkflowRunLog, resetWorkflowRunLogForTests } from './workflowRunLog';
import { exportCompletedWorkflowRunIfConfigured } from './exportCompletedWorkflowRunIfConfigured';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe('exportCompletedWorkflowRunIfConfigured', () => {
  const writeTextInDirectory = vi.fn(
    async (directory: string, fileName: string, content: string) => {
      void directory;
      void fileName;
      void content;
      return { path: '/tmp/out.json' };
    }
  );

  beforeEach(() => {
    writeTextInDirectory.mockClear();
    resetWorkflowRunLogForTests();
    vi.stubGlobal('window', {
      api: { writeTextInDirectory }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no-ops when the directory setting is empty', async () => {
    beginWorkflowRunLog({
      workflowUuid: 'wf-1',
      name: 'Demo',
      environment: '',
      date_created: '2026-07-28T12:00:00.000Z'
    });

    await exportCompletedWorkflowRunIfConfigured(
      () =>
        ({
          settings: { general: { workflowResultsDirectory: '' } }
        }) as never
    );

    expect(writeTextInDirectory).not.toHaveBeenCalled();
  });

  it('writes the workflow-run export when a directory is configured', async () => {
    beginWorkflowRunLog({
      workflowUuid: 'wf-1',
      name: 'Demo',
      environment: 'env-1',
      date_created: '2026-07-28T12:00:00.000Z'
    });

    await exportCompletedWorkflowRunIfConfigured(
      () =>
        ({
          settings: { general: { workflowResultsDirectory: '/tmp/workflow-results' } }
        }) as never
    );

    expect(writeTextInDirectory).toHaveBeenCalledTimes(1);
    const [directory, fileName, content] = writeTextInDirectory.mock.calls[0]!;
    expect(directory).toBe('/tmp/workflow-results');
    expect(fileName).toMatch(/^workflow-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(content)).toMatchObject({
      harborclientVersion: 1,
      harborclientExport: 'workflow-run',
      name: 'Demo',
      environment: 'env-1',
      actions: []
    });
  });
});
