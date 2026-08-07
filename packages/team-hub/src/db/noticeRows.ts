import type {
  NoticeDisplayMetadata,
  NoticeEntityType,
  NoticeEventType,
  NoticeRecord
} from '#/db/types.js';

/**
 * SQL column list for notice SELECT and RETURNING clauses.
 */
export const NOTICE_SELECT_COLUMNS = [
  'id',
  'recipient_user_id',
  'event_type',
  'entity_type',
  'entity_id',
  'request_id',
  'collection_id',
  'folder_id',
  'run_result_id',
  'discussion_thread_id',
  'discussion_comment_id',
  'actor_user_id',
  'created_at',
  'read_at',
  'display_metadata'
].join(', ');

/**
 * Snake_case SQL row shape for notices.
 */
export interface NoticeSqlRow {
  id: string;
  recipient_user_id: string;
  event_type: string;
  entity_type: NoticeEntityType;
  entity_id: string;
  request_id: string | null;
  collection_id: string | null;
  folder_id: string | null;
  run_result_id: string | null;
  discussion_thread_id: string | null;
  discussion_comment_id: string | null;
  actor_user_id: string | null;
  created_at: Date;
  read_at: Date | null;
  display_metadata: string;
}

/**
 * Parses notice display metadata JSON from storage.
 *
 * @param value - Raw JSON text from the database.
 * @returns Parsed metadata object with safe fallbacks for missing fields.
 */
export function parseNoticeDisplayMetadata(value: string): NoticeDisplayMetadata {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      return {
        actorName: typeof record.actorName === 'string' ? record.actorName : 'Someone',
        targetLabel: typeof record.targetLabel === 'string' ? record.targetLabel : '',
        method: typeof record.method === 'string' ? record.method : undefined,
        requestName: typeof record.requestName === 'string' ? record.requestName : undefined,
        runLabel: typeof record.runLabel === 'string' ? record.runLabel : undefined,
        previewText: typeof record.previewText === 'string' ? record.previewText : undefined
      };
    }
  } catch {
    // Fall through to defaults below.
  }

  return {
    actorName: 'Someone',
    targetLabel: ''
  };
}

/**
 * Serializes notice display metadata for SQL storage.
 *
 * @param metadata - Display metadata object.
 * @returns JSON string for persistence.
 */
export function serializeNoticeDisplayMetadata(metadata: NoticeDisplayMetadata): string {
  return JSON.stringify(metadata);
}

/**
 * Maps a snake_case SQL row to the shared {@link NoticeRecord} shape.
 *
 * @param row - Database row from notices.
 * @returns Normalized notice record.
 */
export function mapNoticeSqlRow(row: NoticeSqlRow): NoticeRecord {
  const eventType = row.event_type as NoticeEventType;

  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    eventType,
    entityType: row.entity_type,
    entityId: row.entity_id,
    requestId: row.request_id,
    collectionId: row.collection_id,
    folderId: row.folder_id,
    runResultId: row.run_result_id,
    discussionThreadId: row.discussion_thread_id,
    discussionCommentId: row.discussion_comment_id,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    displayMetadata: parseNoticeDisplayMetadata(row.display_metadata)
  };
}
