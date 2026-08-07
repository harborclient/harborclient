import type {
  DiscussionMlsCommitRecord,
  DiscussionMlsGroupStateRecord,
  DiscussionMlsWelcomeRecord
} from '#/db/types.js';

/**
 * SQL row shape returned by relational backends for discussion MLS commits.
 */
export interface DiscussionMlsCommitSqlRow {
  /**
   * Primary key identifier.
   */
  id: string;

  /**
   * MLS group identifier column.
   */
  mls_group_id: string;

  /**
   * MLS epoch column.
   */
  epoch: number;

  /**
   * Base64 commit ciphertext column.
   */
  ciphertext: string;

  /**
   * Sender device id column.
   */
  sender_device_id: string;

  /**
   * Creation timestamp column.
   */
  created_at: Date;

  /**
   * Creating user identifier column.
   */
  created_by_user_id: string | null;
}

/**
 * SQL row shape returned by relational backends for discussion MLS welcomes.
 */
export interface DiscussionMlsWelcomeSqlRow {
  /**
   * Primary key identifier.
   */
  id: string;

  /**
   * MLS group identifier column.
   */
  mls_group_id: string;

  /**
   * Recipient device id column.
   */
  recipient_device_id: string;

  /**
   * Base64 welcome ciphertext column.
   */
  ciphertext: string;

  /**
   * Base64 ratchet tree column.
   */
  ratchet_tree: string;

  /**
   * Creation timestamp column.
   */
  created_at: Date;

  /**
   * Creating user identifier column.
   */
  created_by_user_id: string | null;
}

/**
 * SQL row shape returned by relational backends for discussion MLS group state.
 */
export interface DiscussionMlsGroupStateSqlRow {
  /**
   * MLS group identifier column.
   */
  mls_group_id: string;

  /**
   * Target entity type column.
   */
  target_entity_type: string;

  /**
   * Target entity id column.
   */
  target_entity_id: string;

  /**
   * Current epoch column.
   */
  current_epoch: number;

  /**
   * Creation timestamp column.
   */
  created_at: Date;

  /**
   * Last update timestamp column.
   */
  updated_at: Date;

  /**
   * Creating user identifier column.
   */
  created_by_user_id: string | null;

  /**
   * Last updating user identifier column.
   */
  updated_by_user_id: string | null;
}

/**
 * Column list shared by relational MLS commit SELECT queries.
 */
export const DISCUSSION_MLS_COMMIT_SELECT_COLUMNS =
  'id, mls_group_id, epoch, ciphertext, sender_device_id, created_at, created_by_user_id';

/**
 * Column list shared by relational MLS welcome SELECT queries.
 */
export const DISCUSSION_MLS_WELCOME_SELECT_COLUMNS =
  'id, mls_group_id, recipient_device_id, ciphertext, ratchet_tree, created_at, created_by_user_id';

/**
 * Column list shared by relational MLS group state SELECT queries.
 */
export const DISCUSSION_MLS_GROUP_STATE_SELECT_COLUMNS =
  'mls_group_id, target_entity_type, target_entity_id, current_epoch, created_at, updated_at, created_by_user_id, updated_by_user_id';

/**
 * Maps a snake_case SQL row to {@link DiscussionMlsCommitRecord}.
 *
 * @param row - Database row from discussion_mls_commits.
 */
export function mapDiscussionMlsCommitSqlRow(
  row: DiscussionMlsCommitSqlRow
): DiscussionMlsCommitRecord {
  return {
    id: row.id,
    mlsGroupId: row.mls_group_id,
    epoch: row.epoch,
    ciphertext: row.ciphertext,
    senderDeviceId: row.sender_device_id,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id
  };
}

/**
 * Maps a snake_case SQL row to {@link DiscussionMlsWelcomeRecord}.
 *
 * @param row - Database row from discussion_mls_welcomes.
 */
export function mapDiscussionMlsWelcomeSqlRow(
  row: DiscussionMlsWelcomeSqlRow
): DiscussionMlsWelcomeRecord {
  return {
    id: row.id,
    mlsGroupId: row.mls_group_id,
    recipientDeviceId: row.recipient_device_id,
    ciphertext: row.ciphertext,
    ratchetTree: row.ratchet_tree,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id
  };
}

/**
 * Maps a snake_case SQL row to {@link DiscussionMlsGroupStateRecord}.
 *
 * @param row - Database row from discussion_mls_group_state.
 */
export function mapDiscussionMlsGroupStateSqlRow(
  row: DiscussionMlsGroupStateSqlRow
): DiscussionMlsGroupStateRecord {
  return {
    mlsGroupId: row.mls_group_id,
    targetEntityType: row.target_entity_type as DiscussionMlsGroupStateRecord['targetEntityType'],
    targetEntityId: row.target_entity_id,
    currentEpoch: row.current_epoch,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id
  };
}
