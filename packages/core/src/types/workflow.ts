import { z } from 'zod';

/**
 * One recorded step inside a workflow session or portable export.
 */
export interface WorkflowAction {
  /**
   * Stable logical event name (for example `request.load`).
   */
  type: string;

  /**
   * Wall-clock time when the action was recorded; optional in portable files.
   */
  at?: number;

  /**
   * Normalized action payload.
   */
  payload: unknown;
}

/**
 * Persisted workflow row from the local registry database.
 */
export interface Workflow {
  /**
   * Database primary key.
   */
  id: number;

  /**
   * Stable portable identifier for export/import.
   */
  uuid: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Accumulated recording duration in milliseconds.
   */
  durationMs: number;

  /**
   * Workflow-scoped variables for future parameterization.
   */
  variables: Record<string, string>;

  /**
   * Ordered recorded actions.
   */
  actions: WorkflowAction[];

  /**
   * Creation timestamp in milliseconds since epoch.
   */
  createdAt: number;

  /**
   * Last update timestamp in milliseconds since epoch.
   */
  updatedAt: number;
}

/**
 * Input for creating a workflow in the local registry.
 */
export interface CreateWorkflowInput {
  /**
   * Display name for the workflow.
   */
  name: string;

  /**
   * Optional portable uuid; generated when omitted.
   */
  uuid?: string;

  /**
   * Accumulated recording duration in milliseconds.
   */
  durationMs: number;

  /**
   * Optional workflow variables; defaults to an empty object.
   */
  variables?: Record<string, string>;

  /**
   * Ordered recorded actions to persist.
   */
  actions: WorkflowAction[];
}

/**
 * Portable HarborClient workflow export envelope.
 */
export interface WorkflowExport {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a workflow export.
   */
  harborclientExport: 'workflow';

  /**
   * Stable portable identifier.
   */
  uuid: string;

  /**
   * Display name for the workflow.
   */
  name: string;

  /**
   * Workflow-scoped variables.
   */
  variables: Record<string, string>;

  /**
   * Ordered recorded actions.
   */
  actions: WorkflowAction[];

  /**
   * Optional recording duration in milliseconds.
   */
  durationMs?: number;
}

const workflowActionSchema = z.object({
  type: z.string().trim().min(1),
  at: z.number().finite().optional(),
  payload: z.unknown()
});

/**
 * Zod schema for validating workflow export files.
 */
export const workflowExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('workflow'),
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  variables: z.record(z.string(), z.string()).default({}),
  actions: z.array(workflowActionSchema),
  durationMs: z.number().finite().nonnegative().optional()
}) satisfies z.ZodType<WorkflowExport>;

/**
 * Validates a parsed workflow export payload.
 *
 * @param data - Unknown parsed JSON.
 * @returns Normalized workflow export.
 * @throws When validation fails.
 */
export function validateWorkflowExport(data: unknown): WorkflowExport {
  return workflowExportSchema.parse(data);
}

/**
 * Builds a portable workflow export envelope.
 *
 * @param input - Workflow fields to serialize.
 * @returns Workflow export object.
 */
export function buildWorkflowExport(input: {
  uuid: string;
  name: string;
  variables?: Record<string, string>;
  actions: WorkflowAction[];
  durationMs?: number;
}): WorkflowExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'workflow',
    uuid: input.uuid,
    name: input.name,
    variables: input.variables ?? {},
    actions: input.actions,
    ...(input.durationMs != null ? { durationMs: input.durationMs } : {})
  };
}
