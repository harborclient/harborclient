import { randomUUID } from 'node:crypto';
import {
  DiscussionCommentForbiddenError,
  DiscussionCommentNotFoundError
} from '#/db/discussionCommentErrors.js';
import {
  assertDiscussionBodyPresent,
  prepareDiscussionCommentInsert
} from '#/db/discussionCommentLogic.js';
import {
  mapDiscussionCommentSqlRow,
  type DiscussionCommentSqlRow
} from '#/db/discussionCommentRows.js';
import type {
  CreateDiscussionCommentInput,
  DiscussionBodyFormat,
  DiscussionCommentRecord,
  ListDiscussionCommentsResult,
  UpdateDiscussionCommentInput
} from '#/db/types.js';

/**
 * Default page size when listing discussion comments.
 */
const DEFAULT_DISCUSSION_LIST_LIMIT = 50;

/**
 * Maximum page size when listing discussion comments.
 */
const MAX_DISCUSSION_LIST_LIMIT = 100;

/**
 * Normalizes list limit values to the supported range.
 *
 * @param limit - Requested page size.
 * @returns Clamped limit between 1 and {@link MAX_DISCUSSION_LIST_LIMIT}.
 */
export function normalizeDiscussionListLimit(limit: number | undefined): number {
  const requested = limit ?? DEFAULT_DISCUSSION_LIST_LIMIT;
  return Math.min(Math.max(requested, 1), MAX_DISCUSSION_LIST_LIMIT);
}

/**
 * Parses an ISO cursor timestamp for discussion comment pagination.
 *
 * @param cursor - Optional ISO timestamp from the client.
 * @returns Parsed Date or null when no cursor was supplied.
 * @throws Error when the cursor is not a valid ISO timestamp.
 */
export function parseDiscussionListCursor(cursor: string | undefined): Date | null {
  if (!cursor) {
    return null;
  }

  const parsed = new Date(cursor);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid discussion list cursor');
  }

  return parsed;
}

/**
 * Builds paginated list output from rows fetched with a limit+1 probe row.
 *
 * @param rows - Raw SQL rows including an optional probe row.
 * @param limit - Requested page size before the probe row.
 * @returns Comments and optional next-page cursor.
 */
export function buildDiscussionListResult(
  rows: DiscussionCommentSqlRow[],
  limit: number
): ListDiscussionCommentsResult {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const comments = pageRows.map(mapDiscussionCommentSqlRow);
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? last.created_at.toISOString() : null;

  return { comments, nextCursor };
}

/**
 * Shared insert preparation for SQL discussion comment backends.
 *
 * @param input - Create payload.
 * @param actingUserId - Author user id.
 * @param findParent - Lookup function for parent comments.
 * @returns Prepared insert values.
 */
export async function prepareSqlDiscussionCommentInsert(
  input: CreateDiscussionCommentInput,
  actingUserId: string,
  findParent: (id: string) => Promise<DiscussionCommentRecord | null>
) {
  const parent = input.parentCommentId ? await findParent(input.parentCommentId) : null;

  return prepareDiscussionCommentInsert(input, actingUserId, parent, randomUUID(), new Date());
}

/**
 * Ensures an active comment exists and belongs to the acting author before updates.
 *
 * @param record - Loaded comment record.
 * @param actingUserId - User attempting the update.
 * @throws DiscussionCommentNotFoundError when the comment is tombstoned.
 * @throws DiscussionCommentForbiddenError when the user is not the author.
 */
export function assertDiscussionCommentEditable(
  record: DiscussionCommentRecord,
  actingUserId: string
): void {
  if (record.tombstonedAt) {
    throw new DiscussionCommentNotFoundError();
  }

  if (record.authorUserId !== actingUserId) {
    throw new DiscussionCommentForbiddenError('You can only edit your own comments');
  }
}

/**
 * Validates a replacement body before persisting an update.
 *
 * @param input - Replacement comment body fields.
 * @returns Normalized update payload.
 */
export function normalizeDiscussionUpdateInput(input: UpdateDiscussionCommentInput): {
  body: string;
  bodyFormat: DiscussionBodyFormat;
  bodyMetadata: Record<string, unknown> | null;
} {
  assertDiscussionBodyPresent(input.body);

  return {
    body: input.body.trim(),
    bodyFormat: input.bodyFormat ?? 'plaintext',
    bodyMetadata: input.bodyMetadata ?? null
  };
}

/**
 * Validates a replacement body before persisting an update.
 *
 * @param body - Replacement comment body.
 * @returns Trimmed body text.
 * @deprecated Use {@link normalizeDiscussionUpdateInput} for encrypted updates.
 */
export function normalizeDiscussionUpdateBody(body: string): string {
  assertDiscussionBodyPresent(body);
  return body.trim();
}
