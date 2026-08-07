import { mapNoticeSqlRow, type NoticeSqlRow } from '#/db/noticeRows.js';
import type { ListNoticesResult } from '#/db/types.js';

/**
 * Default page size when listing notices.
 */
const DEFAULT_NOTICE_LIST_LIMIT = 50;

/**
 * Maximum page size when listing notices.
 */
const MAX_NOTICE_LIST_LIMIT = 100;

/**
 * Normalizes list limit values to the supported range.
 *
 * @param limit - Requested page size.
 * @returns Clamped limit between 1 and {@link MAX_NOTICE_LIST_LIMIT}.
 */
export function normalizeNoticeListLimit(limit: number | undefined): number {
  const requested = limit ?? DEFAULT_NOTICE_LIST_LIMIT;
  return Math.min(Math.max(requested, 1), MAX_NOTICE_LIST_LIMIT);
}

/**
 * Parses an ISO cursor timestamp for notice pagination.
 *
 * @param cursor - Optional ISO timestamp from the client.
 * @returns Parsed Date or null when no cursor was supplied.
 * @throws Error when the cursor is not a valid ISO timestamp.
 */
export function parseNoticeListCursor(cursor: string | undefined): Date | null {
  if (!cursor) {
    return null;
  }

  const parsed = new Date(cursor);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid notice list cursor');
  }

  return parsed;
}

/**
 * Builds paginated list output from rows fetched with a limit+1 probe row.
 *
 * Notices are ordered newest-first; the cursor marks the oldest item on the page.
 *
 * @param rows - Raw SQL rows including an optional probe row.
 * @param limit - Requested page size before the probe row.
 * @returns Notices and optional next-page cursor.
 */
export function buildNoticeListResult(rows: NoticeSqlRow[], limit: number): ListNoticesResult {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const notices = pageRows.map(mapNoticeSqlRow);
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? last.created_at.toISOString() : null;

  return { notices, nextCursor };
}
