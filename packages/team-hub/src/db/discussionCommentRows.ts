import type { DiscussionCommentRecord, DiscussionTargetEntityType } from '#/db/types.js';

/**
 * SQL column list for discussion comment SELECT and RETURNING clauses.
 */
export const DISCUSSION_COMMENT_SELECT_COLUMNS = [
  'id',
  'target_entity_type',
  'target_entity_id',
  'parent_comment_id',
  'root_comment_id',
  'depth',
  'body',
  'body_format',
  'body_metadata',
  'author_user_id',
  'created_at',
  'updated_at',
  'tombstoned_at',
  'tombstoned_by_user_id'
].join(', ');

/**
 * Snake_case SQL row shape for discussion_comments.
 */
export interface DiscussionCommentSqlRow {
  id: string;
  target_entity_type: DiscussionTargetEntityType;
  target_entity_id: string;
  parent_comment_id: string | null;
  root_comment_id: string;
  depth: number;
  body: string;
  body_format: string;
  body_metadata: string | null;
  author_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  tombstoned_at: Date | null;
  tombstoned_by_user_id: string | null;
}

/**
 * Parses optional JSON metadata stored for future encrypted comment bodies.
 *
 * @param value - Raw JSON text from storage.
 * @returns Parsed metadata object or null when absent or invalid.
 */
function parseBodyMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Maps a snake_case SQL row to the shared {@link DiscussionCommentRecord} shape.
 *
 * @param row - Database row from discussion_comments.
 * @returns Normalized discussion comment record.
 */
export function mapDiscussionCommentSqlRow(row: DiscussionCommentSqlRow): DiscussionCommentRecord {
  const depth = row.depth;
  if (depth !== 1 && depth !== 2 && depth !== 3) {
    throw new Error(`Invalid discussion comment depth: ${depth}`);
  }

  const bodyFormat = row.body_format === 'encrypted' ? 'encrypted' : 'plaintext';

  return {
    id: row.id,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    parentCommentId: row.parent_comment_id,
    rootCommentId: row.root_comment_id,
    depth,
    body: row.body,
    bodyFormat,
    bodyMetadata: parseBodyMetadata(row.body_metadata),
    authorUserId: row.author_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tombstonedAt: row.tombstoned_at,
    tombstonedByUserId: row.tombstoned_by_user_id
  };
}

/**
 * Serializes optional body metadata for SQL storage.
 *
 * @param metadata - Metadata object or null.
 * @returns JSON string or null when absent.
 */
export function serializeDiscussionBodyMetadata(
  metadata: Record<string, unknown> | null
): string | null {
  if (!metadata) {
    return null;
  }

  return JSON.stringify(metadata);
}
