import { describe, expect, it } from 'vitest';
import { buildWorkflowRunExportFileName } from './workflowRunExportFile';

describe('buildWorkflowRunExportFileName', () => {
  it('formats local time as workflow-yyyy-mm-dd-hh-mm-ss.json', () => {
    const date = new Date(2026, 6, 28, 13, 59, 7);
    expect(buildWorkflowRunExportFileName(date)).toBe('workflow-2026-07-28-13-59-07.json');
  });
});
