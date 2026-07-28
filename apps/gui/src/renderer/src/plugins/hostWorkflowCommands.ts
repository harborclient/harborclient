import type { Workflow } from '@harborclient/core/types';
import type {
  CreateWorkflowPayload,
  HostWorkflow,
  UpdateWorkflowPayload,
  WorkflowActionRef
} from '@harborclient/sdk';
import { store } from '#/renderer/src/store/redux';
import { setWorkflows } from '#/renderer/src/store/slices/workflowsSlice';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
import { emitPluginWorkflowsChanged } from './pluginWorkflowsChangedBus';

/**
 * Asserts that a value is a numeric workflow database id.
 *
 * @param workflowId - Raw workflow id from a plugin host call.
 * @param methodName - Host method name used in error messages.
 * @throws When `workflowId` is not a number.
 */
export function validateWorkflowId(
  workflowId: unknown,
  methodName: string
): asserts workflowId is number {
  if (typeof workflowId !== 'number' || !Number.isFinite(workflowId)) {
    throw new Error(`harborclient.${methodName} requires a numeric workflow id.`);
  }
}

/**
 * Maps a persisted workflow row to the plugin-facing HostWorkflow DTO.
 *
 * @param workflow - Workflow from storage IPC.
 * @returns Serializable workflow for plugin CRUD APIs.
 */
export function toHostWorkflow(workflow: Workflow): HostWorkflow {
  return {
    id: workflow.id,
    uuid: workflow.uuid,
    name: workflow.name,
    durationMs: workflow.durationMs,
    variables: { ...workflow.variables },
    actions: workflow.actions.map(
      (action): WorkflowActionRef => ({
        uuid: action.uuid,
        type: action.type,
        ...(action.at != null ? { at: action.at } : {}),
        payload: action.payload
      })
    ),
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt
  };
}

/**
 * Finds a workflow row by id or throws.
 *
 * @param items - Workflow list from IPC.
 * @param workflowId - Target database id.
 * @param methodName - Host method name used in error messages.
 * @returns Matching workflow.
 * @throws When the id is missing from the list.
 */
function requireWorkflow(items: Workflow[], workflowId: number, methodName: string): Workflow {
  const found = items.find((item) => item.id === workflowId);
  if (found == null) {
    throw new Error(`harborclient.${methodName}: workflow ${workflowId} was not found.`);
  }
  return found;
}

/**
 * Lists all workflows from the local registry.
 *
 * @returns Plugin-facing workflow rows.
 */
export async function listWorkflowsForPlugin(): Promise<HostWorkflow[]> {
  const items = await window.api.listWorkflows();
  return items.map(toHostWorkflow);
}

/**
 * Returns one workflow by database id, or `null` when missing.
 *
 * @param workflowId - Workflow database id.
 * @returns Matching workflow, or null.
 */
export async function getWorkflowForPlugin(workflowId: number): Promise<HostWorkflow | null> {
  validateWorkflowId(workflowId, 'getWorkflow');
  const items = await window.api.listWorkflows();
  const found = items.find((item) => item.id === workflowId);
  return found == null ? null : toHostWorkflow(found);
}

/**
 * Creates a workflow and refreshes the host store.
 *
 * @param input - Create payload from the plugin.
 * @returns The created workflow row.
 */
export async function createWorkflowForPlugin(input: CreateWorkflowPayload): Promise<HostWorkflow> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.createWorkflow requires an input object.');
  }
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new Error('harborclient.createWorkflow requires a non-empty name.');
  }
  if (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs)) {
    throw new Error('harborclient.createWorkflow requires a numeric durationMs.');
  }
  if (!Array.isArray(input.actions)) {
    throw new Error('harborclient.createWorkflow requires an actions array.');
  }

  const uuid =
    typeof input.uuid === 'string' && input.uuid.trim().length > 0
      ? input.uuid.trim()
      : crypto.randomUUID();
  const items = await window.api.createWorkflow({
    name: input.name.trim(),
    uuid,
    durationMs: input.durationMs,
    variables: input.variables ?? {},
    actions: input.actions
  });
  store.dispatch(setWorkflows(items));
  const created = items.find((item) => item.uuid === uuid);
  if (created == null) {
    throw new Error('harborclient.createWorkflow: created workflow was not returned.');
  }
  emitPluginWorkflowsChanged({ reason: 'created', workflowId: created.id });
  return toHostWorkflow(created);
}

/**
 * Updates a workflow's actions and duration, then refreshes the host store.
 *
 * @param input - Update payload from the plugin.
 * @returns The updated workflow row.
 */
export async function updateWorkflowForPlugin(input: UpdateWorkflowPayload): Promise<HostWorkflow> {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.updateWorkflow requires an input object.');
  }
  validateWorkflowId(input.id, 'updateWorkflow');
  if (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs)) {
    throw new Error('harborclient.updateWorkflow requires a numeric durationMs.');
  }
  if (!Array.isArray(input.actions)) {
    throw new Error('harborclient.updateWorkflow requires an actions array.');
  }

  const items = await window.api.updateWorkflow({
    id: input.id,
    actions: input.actions,
    durationMs: input.durationMs
  });
  store.dispatch(setWorkflows(items));
  emitPluginWorkflowsChanged({ reason: 'updated', workflowId: input.id });
  return toHostWorkflow(requireWorkflow(items, input.id, 'updateWorkflow'));
}

/**
 * Renames a workflow and refreshes the host store.
 *
 * @param workflowId - Workflow database id.
 * @param name - New display name.
 * @returns The renamed workflow row.
 */
export async function renameWorkflowForPlugin(
  workflowId: number,
  name: string
): Promise<HostWorkflow> {
  validateWorkflowId(workflowId, 'renameWorkflow');
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('harborclient.renameWorkflow requires a non-empty name.');
  }

  const items = await window.api.renameWorkflow(workflowId, name.trim());
  store.dispatch(setWorkflows(items));
  emitPluginWorkflowsChanged({ reason: 'renamed', workflowId });
  return toHostWorkflow(requireWorkflow(items, workflowId, 'renameWorkflow'));
}

/**
 * Deletes a workflow (moves it to trash) and refreshes the host store.
 *
 * @param workflowId - Workflow database id.
 */
export async function deleteWorkflowForPlugin(workflowId: number): Promise<void> {
  validateWorkflowId(workflowId, 'deleteWorkflow');
  const items = await window.api.deleteWorkflow(workflowId);
  store.dispatch(setWorkflows(items));
  await syncTrash(store.dispatch);
  emitPluginWorkflowsChanged({ reason: 'deleted', workflowId });
}
