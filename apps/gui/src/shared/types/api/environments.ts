import type { Environment } from '#/shared/types/environment';
import type { Variable } from '#/shared/types/common';

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
   * Updates an environment's name and variables.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @returns The updated environment.
   */
  updateEnvironment: (id: number, name: string, variables: Variable[]) => Promise<Environment>;
  /**
   * Updates an environment sidebar color.
   *
   * @param id - Environment ID to update.
   * @param color - CSS color string, or null to clear.
   * @returns The updated environment.
   */
  setEnvironmentColor: (id: number, color: string | null) => Promise<Environment>;
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
