import type { TabGroup } from '#/shared/types/tabGroup';

/**
 * Returns a compact summary label for a tab group row.
 *
 * @param group - Tab group shown in the sidebar.
 * @returns Request count label for the row metadata column.
 */
export function tabGroupSummaryText(group: TabGroup): string {
  const count = group.requests.length;
  return count === 1 ? '1 request' : `${count} requests`;
}

/**
 * Builds a stable dnd-kit id for a tab group row.
 *
 * @param id - Tab group database id.
 */
export function tabGroupDragId(id: number): string {
  return `tab-group:${id}`;
}

/**
 * Parses a tab group drag id back to its numeric id.
 *
 * @param dragId - Sortable id from dnd-kit.
 */
export function parseTabGroupDragId(dragId: string): number | null {
  const match = /^tab-group:(\d+)$/.exec(dragId);
  return match ? Number(match[1]) : null;
}
