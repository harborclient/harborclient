import type { Variable } from '#/shared/types/common';

/**
 * A named group of variables available when the environment is active.
 */
export interface Environment {
  /**
   * Unique database ID.
   */
  id: number;

  /**
   * Stable portable identifier for export/import deduplication.
   */
  uuid: string;

  /**
   * Display name shown in the sidebar and TabBar dropdown.
   */
  name: string;

  /**
   * Environment-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * ISO 8601 timestamp when the environment was created.
   */
  created_at: string;

  /**
   * When true on a team hub environment, non-admin users cannot delete it on the server.
   */
  deletion_locked?: boolean;

  /**
   * Optional sidebar color for visual grouping (CSS hex or rgba string).
   */
  color?: string | null;
}
/**
 * Portable environment export file format.
 */
export interface EnvironmentExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as an environment export.
   */
  harborclientExport: 'environment';

  /**
   * Stable portable identifier; omitted in legacy export files.
   */
  uuid?: string;

  /**
   * Display name for the environment.
   */
  name: string;

  /**
   * Environment-scoped variables for {{key}} substitution in requests.
   */
  variables: Variable[];

  /**
   * Optional sidebar color for visual grouping (CSS hex or rgba string).
   */
  color?: string | null;
}
