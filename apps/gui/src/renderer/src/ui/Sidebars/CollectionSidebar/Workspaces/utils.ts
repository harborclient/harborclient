import type { Workspace } from '@harborclient/core/types/workspace';

/**
 * Returns a compact summary label for a workspace row.
 *
 * @param group - Workspace shown in the sidebar.
 * @returns Request count label for the row metadata column.
 */
export function workspaceSummaryText(group: Workspace): string {
  const count = group.requests.length;
  return count === 1 ? '1 request' : `${count} requests`;
}

/**
 * Builds a stable dnd-kit id for a workspace row.
 *
 * @param id - Workspace database id.
 */
export function workspaceDragId(id: number): string {
  return `tab-group:${id}`;
}

/**
 * Parses a workspace drag id back to its numeric id.
 *
 * @param dragId - Sortable id from dnd-kit.
 */
export function parseWorkspaceDragId(dragId: string): number | null {
  const match = /^tab-group:(\d+)$/.exec(dragId);
  return match ? Number(match[1]) : null;
}
