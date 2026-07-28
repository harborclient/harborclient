import type { Environment } from '../environment';
import type { Variable } from '../common';

/**
 * IPC methods for environments.
 */
export interface ApiEnvironments {
  /**
   * Lists all environments.
   *
   * @returns All environments from the main process.
   */
  listEnvironments: () => Promise<Environment[]>;
  /**
   * Creates a new environment.
   *
   * @param name - Display name for the environment.
   * @returns The newly created environment.
   */
  createEnvironment: (name: string) => Promise<Environment>;
  /**
   * Updates an environment's name, variables, and optional parent link.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @param parentUuid - Parent environment uuid to inherit from; `null` clears;
   *   omit to leave the existing parent unchanged.
   * @returns The updated environment.
   */
  updateEnvironment: (
    id: number,
    name: string,
    variables: Variable[],
    parentUuid?: string | null
  ) => Promise<Environment>;
  /**
   * Updates an environment sidebar marker.
   *
   * @param id - Environment ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated environment.
   */
  setEnvironmentMarker: (id: number, marker: string | null) => Promise<Environment>;
  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  deleteEnvironment: (id: number) => Promise<void>;
  /**
   * Deep-copies an environment into a new record with a fresh uuid.
   *
   * @param id - Environment ID to duplicate.
   * @returns The newly created environment.
   */
  duplicateEnvironment: (id: number) => Promise<Environment>;
  /**
   * Reorders environments in the sidebar.
   *
   * @param orderedEnvironmentIds - Environment ids in desired order.
   */
  reorderEnvironments: (orderedEnvironmentIds: number[]) => Promise<void>;
}
