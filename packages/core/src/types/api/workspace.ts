import type {
  CreateWorkspaceInput,
  Workspace,
  WorkspaceLayout,
  WorkspaceRequest
} from '../workspace';

/**
 * IPC surface for local workspace persistence.
 */
export interface ApiWorkspaces {
  /**
   * Lists all workspaces from the local registry.
   */
  listWorkspaces: () => Promise<Workspace[]>;

  /**
   * Creates a workspace and returns the refreshed list.
   */
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace[]>;

  /**
   * Replaces workspace members and optional layout and returns the refreshed list.
   */
  updateWorkspace: (
    id: number,
    requests: WorkspaceRequest[],
    layout?: WorkspaceLayout | null
  ) => Promise<Workspace[]>;

  /**
   * Renames a workspace and returns the refreshed list.
   */
  renameWorkspace: (id: number, name: string) => Promise<Workspace[]>;

  /**
   * Clones a workspace under a new name and returns the refreshed list.
   */
  cloneWorkspace: (id: number, name: string) => Promise<Workspace[]>;

  /**
   * Deletes a workspace and returns the refreshed list.
   */
  deleteWorkspace: (id: number) => Promise<Workspace[]>;

  /**
   * Persists a new sidebar order for workspaces and returns the refreshed list.
   */
  reorderWorkspaces: (orderedWorkspaceIds: number[]) => Promise<Workspace[]>;

  /**
   * Updates a workspace sidebar marker and returns the refreshed list.
   */
  setWorkspaceMarker: (id: number, marker: string | null) => Promise<Workspace[]>;

  /**
   * Imports a workspace from a JSON file via a native open dialog.
   */
  importWorkspace: () => Promise<Workspace[] | null>;
}
