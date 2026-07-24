import { z } from 'zod';

/**
 * One saved request reference stored in a tab group.
 */
export interface TabGroupRequest {
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
 * A named group of saved request tabs persisted in the local registry.
 */
export interface TabGroup {
  /**
   * Numeric primary key in the local registry.
   */
  id: number;

  /**
   * User-visible group name.
   */
  name: string;

  /**
   * Ordered saved requests in this group.
   */
  requests: TabGroupRequest[];

  /**
   * Unix epoch milliseconds when the group was created.
   */
  createdAt: number;

  /**
   * Unix epoch milliseconds when the group was last updated.
   */
  updatedAt: number;

  /**
   * Optional sidebar color for visual grouping (CSS hex or rgba string).
   */
  color?: string | null;
}

/**
 * Input for creating a tab group from the renderer.
 */
export interface CreateTabGroupInput {
  /**
   * User-visible group name.
   */
  name: string;

  /**
   * Ordered saved requests to store in the group.
   */
  requests: TabGroupRequest[];

  /**
   * Optional sidebar color for visual grouping (CSS hex or rgba string).
   */
  color?: string | null;
}

/**
 * Portable tab group export envelope.
 */
export interface TabGroupExport {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Export discriminator for File -> Import routing.
   */
  harborclientExport: 'tab_group';

  /**
   * Exported group name.
   */
  name: string;

  /**
   * Saved request uuids in display order. Full request details are not exported.
   */
  requestUuids: string[];

  /**
   * Optional sidebar color for visual grouping (CSS hex or rgba string).
   */
  color?: string | null;
}

/**
 * Zod schema for validating tab group export files.
 */
export const tabGroupExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('tab_group'),
  name: z.string().trim().min(1),
  requestUuids: z.array(z.string().trim().min(1)),
  color: z.union([z.string().trim().min(1), z.null()]).optional()
}) satisfies z.ZodType<TabGroupExport>;

/**
 * Validates a parsed tab group export payload.
 *
 * @param data - Parsed JSON from an export file.
 * @returns Validated export envelope.
 * @throws When the payload does not match the tab group export schema.
 */
export function validateTabGroupExport(data: unknown): TabGroupExport {
  const result = tabGroupExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid tab group export: ${result.error.message}`);
  }
  return result.data;
}
