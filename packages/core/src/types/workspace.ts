import { z } from 'zod';

/**
 * One saved request reference stored in a workspace.
 */
export interface WorkspaceRequest {
  /**
   * Stable request uuid used for export and reopen.
   */
  requestUuid: string;

  /**
   * Collection id at capture time for faster reopen.
   */
  collectionId?: number;

  /**
   * Display name at capture time for sidebar rows.
   */
  requestName?: string;
}

/**
 * A named set of saved request tabs persisted in the local registry.
 */
export interface Workspace {
  /**
   * Numeric primary key in the local registry.
   */
  id: number;

  /**
   * User-visible workspace name.
   */
  name: string;

  /**
   * Ordered saved requests in this workspace.
   */
  requests: WorkspaceRequest[];

  /**
   * Unix epoch milliseconds when the workspace was created.
   */
  createdAt: number;

  /**
   * Unix epoch milliseconds when the workspace was last updated.
   */
  updatedAt: number;

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
}

/**
 * Input for creating a workspace from the renderer.
 */
export interface CreateWorkspaceInput {
  /**
   * User-visible workspace name.
   */
  name: string;

  /**
   * Ordered saved requests to store in the workspace.
   */
  requests: WorkspaceRequest[];

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
}

/**
 * Portable workspace export envelope.
 */
export interface WorkspaceExport {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Export discriminator for File -> Import routing.
   */
  harborclientExport: 'workspace';

  /**
   * Exported workspace name.
   */
  name: string;

  /**
   * Saved request uuids in display order. Full request details are not exported.
   */
  requestUuids: string[];

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;
}

/**
 * Zod schema for validating workspace export files.
 */
export const workspaceExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('workspace'),
  name: z.string().trim().min(1),
  requestUuids: z.array(z.string().trim().min(1)),
  marker: z.union([z.string().trim().min(1), z.null()]).optional()
}) satisfies z.ZodType<WorkspaceExport>;

/**
 * Validates a parsed workspace export payload.
 *
 * @param data - Parsed JSON from an export file.
 * @returns Validated export envelope.
 * @throws When the payload does not match the workspace export schema.
 */
export function validateWorkspaceExport(data: unknown): WorkspaceExport {
  const result = workspaceExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid workspace export: ${result.error.message}`);
  }
  return result.data;
}
