import type { Variable } from '#/shared/types';

/**
 * Counts persisted environment variables (non-empty keys only).
 *
 * @param variables - Environment-scoped variable rows.
 * @returns Number of variables with a non-empty key.
 */
export function environmentVariableCount(variables: Variable[]): number {
  return variables.filter((variable) => variable.key.trim() !== '').length;
}

/**
 * Returns a compact summary label for an environment row.
 *
 * @param variables - Environment-scoped variable rows.
 * @returns Variable count label for the row metadata column.
 */
export function environmentSummaryText(variables: Variable[]): string {
  const count = environmentVariableCount(variables);
  return count === 1 ? '1 variable' : `${count} variables`;
}

/**
 * Builds a stable dnd-kit id for an environment row.
 *
 * @param id - Environment database id.
 */
export function environmentDragId(id: number): string {
  return `environment:${id}`;
}

/**
 * Parses an environment drag id back to its numeric id.
 *
 * @param dragId - Sortable id from dnd-kit.
 */
export function parseEnvironmentDragId(dragId: string): number | null {
  const match = /^environment:(\d+)$/.exec(dragId);
  return match ? Number(match[1]) : null;
}
