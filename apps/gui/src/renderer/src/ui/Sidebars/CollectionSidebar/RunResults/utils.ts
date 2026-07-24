import type { SavedRunResultSummary } from '#/shared/collectionRunner';

/**
 * Builds a stable sortable id for a run result row.
 *
 * @param id - Run result database id.
 */
export function runResultDragId(id: number): string {
  return `run-result:${id}`;
}

/**
 * Returns a compact pass/fail summary for a saved run result row, used only for
 * the accessible label since the row itself shows a status dot instead of text.
 *
 * @param summary - Aggregate counts from the saved snapshot.
 */
export function runResultSummaryText(summary: SavedRunResultSummary['summary']): string {
  const parts = [`${summary.passed} passed`, `${summary.failed} failed`];
  if (summary.skipped > 0) {
    parts.push(`${summary.skipped} skipped`);
  }
  return parts.join(', ');
}

/**
 * Returns the status dot color class for a saved run result's overall outcome.
 *
 * @param summary - Aggregate counts from the saved snapshot.
 */
export function runResultStatusDotClass(summary: SavedRunResultSummary['summary']): string {
  if (summary.failed > 0) {
    return 'bg-danger';
  }
  if (summary.passed > 0) {
    return 'bg-success';
  }
  return 'bg-muted';
}

/**
 * Formats a saved run's creation timestamp for sidebar row display.
 *
 * @param createdAt - ISO timestamp when the run result was saved.
 * @returns Date/time string such as `2026-07-11 10:23:03`.
 */
export function formatRunResultRowDate(createdAt: string): string {
  return new Date(createdAt).toISOString().replace('T', ' ').slice(0, 19);
}
