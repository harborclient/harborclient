import type { CreateWorkflowInput, UpdateWorkflowInput, Workflow } from '../workflow';

/**
 * IPC surface for local workflow persistence.
 */
export interface ApiWorkflows {
  /**
   * Lists all workflows from the local registry.
   */
  listWorkflows: () => Promise<Workflow[]>;

  /**
   * Creates a workflow and returns the refreshed list.
   */
  createWorkflow: (input: CreateWorkflowInput) => Promise<Workflow[]>;

  /**
   * Renames a workflow and returns the refreshed list.
   */
  renameWorkflow: (id: number, name: string) => Promise<Workflow[]>;

  /**
   * Updates a workflow's actions and duration and returns the refreshed list.
   */
  updateWorkflow: (input: UpdateWorkflowInput) => Promise<Workflow[]>;

  /**
   * Deletes a workflow (moves it to trash) and returns the refreshed list.
   */
  deleteWorkflow: (id: number) => Promise<Workflow[]>;

  /**
   * Marks or unmarks a workflow as archived and returns the refreshed list.
   *
   * @param id - Workflow id.
   * @param archived - When true, hide the workflow from the Workflows list.
   */
  setWorkflowArchived: (id: number, archived: boolean) => Promise<Workflow[]>;
}
