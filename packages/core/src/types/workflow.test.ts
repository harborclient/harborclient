import { describe, expect, it } from 'vitest';
import { buildWorkflowExport, validateWorkflowExport } from './workflow';

describe('buildWorkflowExport', () => {
  it('builds a portable workflow envelope with defaults', () => {
    const envelope = buildWorkflowExport({
      uuid: 'wf-1',
      name: 'Morning checks',
      actions: [{ type: 'request.load', at: 100, payload: { uuid: 'req-1' } }]
    });

    expect(envelope).toEqual({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-1',
      name: 'Morning checks',
      variables: {},
      actions: [{ type: 'request.load', at: 100, payload: { uuid: 'req-1' } }]
    });
  });

  it('includes duration and variables when provided', () => {
    const envelope = buildWorkflowExport({
      uuid: 'wf-2',
      name: 'With vars',
      variables: { env: 'qa' },
      durationMs: 12_500,
      actions: [{ type: 'environment.setActive', payload: { id: 3 } }]
    });

    expect(envelope.variables).toEqual({ env: 'qa' });
    expect(envelope.durationMs).toBe(12_500);
  });
});

describe('validateWorkflowExport', () => {
  it('accepts a valid workflow export', () => {
    const exportData = validateWorkflowExport({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-3',
      name: 'Valid',
      variables: {},
      actions: [{ type: 'tabs.openPage', payload: { page: 'settings' } }],
      durationMs: 1000
    });

    expect(exportData.harborclientExport).toBe('workflow');
    expect(exportData.actions).toHaveLength(1);
  });

  it('defaults missing variables to an empty object', () => {
    const exportData = validateWorkflowExport({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-4',
      name: 'No vars',
      actions: []
    });

    expect(exportData.variables).toEqual({});
  });

  it('rejects unknown export kinds', () => {
    expect(() =>
      validateWorkflowExport({
        harborclientVersion: 1,
        harborclientExport: 'workspace',
        uuid: 'wf-5',
        name: 'Wrong kind',
        actions: []
      })
    ).toThrow();
  });

  it('rejects empty action types', () => {
    expect(() =>
      validateWorkflowExport({
        harborclientVersion: 1,
        harborclientExport: 'workflow',
        uuid: 'wf-6',
        name: 'Bad action',
        actions: [{ type: '  ', payload: {} }]
      })
    ).toThrow();
  });
});
