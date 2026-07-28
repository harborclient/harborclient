import { describe, expect, it } from 'vitest';
import { buildWorkflowExport, normalizeWorkflowDelayMs, validateWorkflowExport } from './workflow';

describe('normalizeWorkflowDelayMs', () => {
  it('floors finite non-negative numbers', () => {
    expect(normalizeWorkflowDelayMs(250.9)).toBe(250);
    expect(normalizeWorkflowDelayMs(0)).toBe(0);
  });

  it('maps invalid values to 0', () => {
    expect(normalizeWorkflowDelayMs(-1)).toBe(0);
    expect(normalizeWorkflowDelayMs(Number.NaN)).toBe(0);
    expect(normalizeWorkflowDelayMs(undefined)).toBe(0);
    expect(normalizeWorkflowDelayMs('nope')).toBe(0);
  });
});

describe('buildWorkflowExport', () => {
  it('builds a portable workflow envelope with defaults', () => {
    const envelope = buildWorkflowExport({
      uuid: 'wf-1',
      name: 'Morning checks',
      actions: [{ uuid: 'action-1', type: 'request.load', at: 100, payload: { uuid: 'req-1' } }]
    });

    expect(envelope).toEqual({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-1',
      name: 'Morning checks',
      variables: {},
      actions: [{ uuid: 'action-1', type: 'request.load', at: 100, payload: { uuid: 'req-1' } }]
    });
  });

  it('includes duration, delay, and variables when provided', () => {
    const envelope = buildWorkflowExport({
      uuid: 'wf-2',
      name: 'With vars',
      variables: { env: 'qa' },
      durationMs: 12_500,
      delayMs: 250,
      actions: [{ uuid: 'action-2', type: 'environment.setActive', payload: { id: 3 } }]
    });

    expect(envelope.variables).toEqual({ env: 'qa' });
    expect(envelope.durationMs).toBe(12_500);
    expect(envelope.delayMs).toBe(250);
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
      actions: [{ uuid: 'action-3', type: 'tabs.openPage', payload: { page: 'settings' } }],
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

  it('accepts an optional delayMs', () => {
    const exportData = validateWorkflowExport({
      harborclientVersion: 1,
      harborclientExport: 'workflow',
      uuid: 'wf-4b',
      name: 'With delay',
      actions: [],
      delayMs: 500
    });

    expect(exportData.delayMs).toBe(500);
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
        actions: [{ uuid: 'action-6', type: '  ', payload: {} }]
      })
    ).toThrow();
  });

  it('rejects actions missing uuid', () => {
    expect(() =>
      validateWorkflowExport({
        harborclientVersion: 1,
        harborclientExport: 'workflow',
        uuid: 'wf-7',
        name: 'Missing action uuid',
        actions: [{ type: 'request.send', payload: { target: 'active' } }]
      })
    ).toThrow();
  });
});
