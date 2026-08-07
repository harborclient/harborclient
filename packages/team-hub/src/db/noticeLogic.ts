import { canAccessCollection, canUseDataApi } from '#/server/auth/accessControl.js';
import type {
  DiscussionCommentRecord,
  NoticeEntityType,
  NoticeRecord,
  NotificationLevel,
  UserRecord
} from '#/db/types.js';

/**
 * Reason a notice is being delivered to a recipient.
 */
export type NoticeDeliveryReason =
  | 'mention'
  | 'thread_subscription'
  | 'parent_author'
  | 'entity_activity';

/**
 * Returns whether a notification level permits delivery for the given reason.
 *
 * @param level - Recipient notification preference.
 * @param reason - Delivery reason being evaluated.
 * @returns True when the notice should be created for this recipient.
 */
export function shouldDeliverNotice(
  level: NotificationLevel,
  reason: NoticeDeliveryReason
): boolean {
  if (level === 'none') {
    return false;
  }

  if (level === 'mentions') {
    return reason === 'mention';
  }

  return true;
}

/**
 * Returns true when the actor and recipient are the same user (self-noise).
 *
 * @param actorUserId - User who triggered the event.
 * @param recipientUserId - Candidate notice recipient.
 * @returns True when the notice would be self-noise.
 */
export function isSelfNotice(actorUserId: string, recipientUserId: string): boolean {
  return actorUserId === recipientUserId;
}

/**
 * Returns users who may receive notices for a collection-scoped resource.
 *
 * @param users - Tenant user accounts.
 * @param collectionId - Collection governing access.
 * @param actorUserId - User who triggered the event (excluded from results).
 * @returns Users with data API access to the collection, excluding the actor.
 */
export function listCollectionNoticeRecipients(
  users: UserRecord[],
  collectionId: string,
  actorUserId: string
): UserRecord[] {
  return users.filter(
    (user) =>
      user.id !== actorUserId && canUseDataApi(user) && canAccessCollection(user, collectionId)
  );
}

/**
 * Returns users who may receive notices for run-result activity.
 *
 * When a collection id is known, recipients follow collection access. Otherwise any
 * data API user except the actor is eligible, matching run-result discussion access.
 *
 * @param users - Tenant user accounts.
 * @param actorUserId - User who triggered the event (excluded from results).
 * @param collectionId - Optional collection id extracted from run metadata.
 * @returns Eligible notice recipients excluding the actor.
 */
export function listRunResultNoticeRecipients(
  users: UserRecord[],
  actorUserId: string,
  collectionId: string | null
): UserRecord[] {
  if (collectionId) {
    return listCollectionNoticeRecipients(users, collectionId, actorUserId);
  }

  return users.filter((user) => user.id !== actorUserId && canUseDataApi(user));
}

/**
 * Returns true when a user can still access the entity referenced by a notice.
 *
 * @param user - Authenticated recipient.
 * @param notice - Stored notice record.
 * @returns True when the notice target remains accessible.
 */
export function canAccessNoticeEntity(user: UserRecord, notice: NoticeRecord): boolean {
  if (!canUseDataApi(user)) {
    return false;
  }

  if (notice.entityType === 'runResult') {
    return true;
  }

  const collectionId = notice.collectionId;
  if (!collectionId) {
    return false;
  }

  return canAccessCollection(user, collectionId);
}

/**
 * Filters a notice page to entries the recipient can still access.
 *
 * @param user - Authenticated recipient.
 * @param notices - Unfiltered notice records from storage.
 * @returns Notices whose target entities remain accessible.
 */
export function filterAccessibleNotices(user: UserRecord, notices: NoticeRecord[]): NoticeRecord[] {
  return notices.filter((notice) => canAccessNoticeEntity(user, notice));
}

/**
 * Maps a discussion target entity type to the notice entity type enum.
 *
 * @param targetEntityType - Discussion target entity type.
 * @returns Matching notice entity type.
 */
export function discussionTargetToNoticeEntityType(
  targetEntityType: DiscussionCommentRecord['targetEntityType']
): NoticeEntityType {
  return targetEntityType;
}

/**
 * Extracts a collection id from a HarborClient run-results export payload when present.
 *
 * @param payload - Raw run result export payload.
 * @returns Collection id or null when not embedded in the payload.
 */
export function extractRunResultCollectionId(payload: Record<string, unknown>): string | null {
  const collection = payload.collection;
  if (collection == null || typeof collection !== 'object' || Array.isArray(collection)) {
    return null;
  }

  const id = (collection as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}
