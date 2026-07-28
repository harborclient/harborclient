import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workflow } from '@harborclient/core/types';
import {
  createWorkflowForPlugin,
  deleteWorkflowForPlugin,
  getWorkflowForPlugin,
  listWorkflowsForPlugin,
  renameWorkflowForPlugin,
  toHostWorkflow,
  updateWorkflowForPlugin,
  validateWorkflowId
} from './hostWorkflowCommands';

const listWorkflowsMock = vi.fn();
const createWorkflowMock = vi.fn();
const updateWorkflowMock = vi.fn();
const renameWorkflowMock = vi.fn();
const deleteWorkflowMock = vi.fn();
const listTrashItemsMock = vi.fn();
const pushPluginWorkflowsChangedMock = vi.fn().mockResolvedValue(undefined);

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: vi.fn()
  }
}));

/**
 * Builds a minimal workflow fixture for host workflow tests.
 *
 * @param overrides - Fields to override on the base workflow.
 */
function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 1,
    uuid: 'wf-1',
    name: 'Smoke',
    durationMs: 1200,
    delayMs: 0,
    variables: { env: 'dev' },
    actions: [{ uuid: 'action-1', type: 'request.load', at: 10, payload: { requestId: 3 } }],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000,
    ...overrides
  };
}

beforeEach(() => {
  listWorkflowsMock.mockReset();
  createWorkflowMock.mockReset();
  updateWorkflowMock.mockReset();
  renameWorkflowMock.mockReset();
  deleteWorkflowMock.mockReset();
  listTrashItemsMock.mockReset();
  pushPluginWorkflowsChangedMock.mockClear();
  listTrashItemsMock.mockResolvedValue([]);
  vi.stubGlobal('window', {
    api: {
      listWorkflows: listWorkflowsMock,
      createWorkflow: createWorkflowMock,
      updateWorkflow: updateWorkflowMock,
      renameWorkflow: renameWorkflowMock,
      deleteWorkflow: deleteWorkflowMock,
      listTrashItems: listTrashItemsMock,
      pushPluginWorkflowsChanged: pushPluginWorkflowsChangedMock
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hostWorkflowCommands validators', () => {
  it('accepts numeric workflow ids', () => {
    expect(() => validateWorkflowId(3, 'getWorkflow')).not.toThrow();
  });

  it('rejects non-numeric workflow ids', () => {
    expect(() => validateWorkflowId('3', 'getWorkflow')).toThrow(
      /getWorkflow requires a numeric workflow id/
    );
  });
});

describe('hostWorkflowCommands mappers', () => {
  it('maps Workflow rows to HostWorkflow DTOs', () => {
    expect(toHostWorkflow(makeWorkflow())).toEqual({
      id: 1,
      uuid: 'wf-1',
      name: 'Smoke',
      durationMs: 1200,
      delayMs: 0,
      variables: { env: 'dev' },
      actions: [{ uuid: 'action-1', type: 'request.load', at: 10, payload: { requestId: 3 } }],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_001_000
    });
  });
});

describe('hostWorkflowCommands CRUD', () => {
  it('lists workflows', async () => {
    listWorkflowsMock.mockResolvedValue([makeWorkflow()]);
    await expect(listWorkflowsForPlugin()).resolves.toEqual([toHostWorkflow(makeWorkflow())]);
  });

  it('returns null from getWorkflow when missing', async () => {
    listWorkflowsMock.mockResolvedValue([makeWorkflow({ id: 2 })]);
    await expect(getWorkflowForPlugin(1)).resolves.toBeNull();
  });

  it('creates a workflow and emits workflows.changed', async () => {
    const created = makeWorkflow({ id: 9, uuid: 'wf-new', name: 'New' });
    createWorkflowMock.mockResolvedValue([created]);

    const result = await createWorkflowForPlugin({
      name: 'New',
      uuid: 'wf-new',
      durationMs: 0,
      actions: []
    });

    expect(result).toEqual(toHostWorkflow(created));
    expect(pushPluginWorkflowsChangedMock).toHaveBeenCalledWith({
      reason: 'created',
      workflowId: 9
    });
  });

  it('updates a workflow', async () => {
    const updated = makeWorkflow({ durationMs: 50, delayMs: 100, actions: [] });
    updateWorkflowMock.mockResolvedValue([updated]);

    const result = await updateWorkflowForPlugin({
      id: 1,
      durationMs: 50,
      delayMs: 100,
      actions: []
    });

    expect(result.durationMs).toBe(50);
    expect(result.delayMs).toBe(100);
    expect(pushPluginWorkflowsChangedMock).toHaveBeenCalledWith({
      reason: 'updated',
      workflowId: 1
    });
  });

  it('renames a workflow', async () => {
    const renamed = makeWorkflow({ name: 'Renamed' });
    renameWorkflowMock.mockResolvedValue([renamed]);

    const result = await renameWorkflowForPlugin(1, 'Renamed');
    expect(result.name).toBe('Renamed');
    expect(pushPluginWorkflowsChangedMock).toHaveBeenCalledWith({
      reason: 'renamed',
      workflowId: 1
    });
  });

  it('deletes a workflow', async () => {
    deleteWorkflowMock.mockResolvedValue([]);
    await deleteWorkflowForPlugin(1);
    expect(deleteWorkflowMock).toHaveBeenCalledWith(1);
    expect(pushPluginWorkflowsChangedMock).toHaveBeenCalledWith({
      reason: 'deleted',
      workflowId: 1
    });
  });
});
