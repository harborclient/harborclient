import { z } from 'zod';
import type {
  NoticeDisplayMetadata,
  NoticeEntityType,
  NoticeEventType,
  NoticeRecord,
  NotificationLevel,
  UserNotificationSettingsRecord,
  UserRecord
} from '#/db/types.js';
import {
  serializeDiscussionAuthor,
  serializeUnknownDiscussionAuthor,
  serializeUserAuthorMetadata
} from '#/server/routes/schemas/userAuthor.js';

/**
 * Supported notification preference levels.
 */
export const notificationLevelSchema = z.enum(['all', 'mentions', 'none']);

/**
 * Notice event type values exposed by the REST API.
 */
export const noticeEventTypeSchema = z.enum([
  'request.updated',
  'discussion.comment',
  'discussion.reply',
  'discussion.mention',
  'runResult.created',
  'runResult.failed'
]);

/**
 * Entity kinds referenced by notices.
 */
export const noticeEntityTypeSchema = z.enum(['request', 'collection', 'folder', 'runResult']);

/**
 * Display metadata attached to notice list rows.
 */
export const noticeDisplayMetadataSchema = z.object({
  actorName: z.string(),
  targetLabel: z.string(),
  method: z.string().optional(),
  requestName: z.string().optional(),
  runLabel: z.string().optional(),
  previewText: z.string().optional()
});

/**
 * Actor metadata embedded in notice responses.
 */
export const noticeActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z
    .object({
      initials: z.string(),
      color: z.string()
    })
    .optional()
});

/**
 * REST payload for one collaboration notice.
 */
export const noticeSchema = z.object({
  id: z.string(),
  eventType: noticeEventTypeSchema,
  entityType: noticeEntityTypeSchema,
  entityId: z.string(),
  requestId: z.string().nullable(),
  collectionId: z.string().nullable(),
  folderId: z.string().nullable(),
  runResultId: z.string().nullable(),
  discussionThreadId: z.string().nullable(),
  discussionCommentId: z.string().nullable(),
  actor: noticeActorSchema,
  createdAt: z.string(),
  readAt: z.string().nullable(),
  displayMetadata: noticeDisplayMetadataSchema
});

/**
 * Query parameters for listing notices.
 */
export const listNoticesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

/**
 * Paginated notice list response.
 */
export const listNoticesResponseSchema = z.object({
  notices: z.array(noticeSchema),
  nextCursor: z.string().optional()
});

/**
 * Unread notice count response.
 */
export const unreadNoticeCountResponseSchema = z.object({
  count: z.number().int().min(0)
});

/**
 * Notification settings response payload.
 */
export const notificationSettingsResponseSchema = z.object({
  level: notificationLevelSchema,
  updatedAt: z.string()
});

/**
 * Request body for updating notification settings.
 */
export const updateNotificationSettingsBodySchema = z.object({
  level: notificationLevelSchema
});

/**
 * Thread subscription status response.
 */
export const threadSubscriptionResponseSchema = z.object({
  subscribed: z.boolean(),
  rootCommentId: z.string()
});

/**
 * Serializes notice display metadata for REST responses.
 *
 * @param metadata - Stored notice metadata.
 * @returns API display metadata payload.
 */
export function serializeNoticeDisplayMetadata(
  metadata: NoticeDisplayMetadata
): z.infer<typeof noticeDisplayMetadataSchema> {
  return {
    actorName: metadata.actorName,
    targetLabel: metadata.targetLabel,
    ...(metadata.method ? { method: metadata.method } : {}),
    ...(metadata.requestName ? { requestName: metadata.requestName } : {}),
    ...(metadata.runLabel ? { runLabel: metadata.runLabel } : {}),
    ...(metadata.previewText ? { previewText: metadata.previewText } : {})
  };
}

/**
 * Serializes one notice record with actor metadata for REST responses.
 *
 * @param notice - Stored notice record.
 * @param actor - Resolved actor user record, when available.
 * @returns REST notice payload.
 */
export function serializeNotice(
  notice: NoticeRecord,
  actor: UserRecord | null
): z.infer<typeof noticeSchema> {
  const authorPayload =
    actor != null
      ? serializeDiscussionAuthor(actor)
      : serializeUnknownDiscussionAuthor(notice.actorUserId);

  return {
    id: notice.id,
    eventType: notice.eventType as NoticeEventType,
    entityType: notice.entityType as NoticeEntityType,
    entityId: notice.entityId,
    requestId: notice.requestId,
    collectionId: notice.collectionId,
    folderId: notice.folderId,
    runResultId: notice.runResultId,
    discussionThreadId: notice.discussionThreadId,
    discussionCommentId: notice.discussionCommentId,
    actor: {
      id: authorPayload.id,
      name: authorPayload.name,
      ...(authorPayload.avatar ? { avatar: authorPayload.avatar } : {})
    },
    createdAt: notice.createdAt.toISOString(),
    readAt: notice.readAt?.toISOString() ?? null,
    displayMetadata: serializeNoticeDisplayMetadata(notice.displayMetadata)
  };
}

/**
 * Serializes notification settings for REST responses.
 *
 * @param settings - Stored notification settings record.
 * @returns REST notification settings payload.
 */
export function serializeNotificationSettings(
  settings: UserNotificationSettingsRecord
): z.infer<typeof notificationSettingsResponseSchema> {
  return {
    level: settings.level as NotificationLevel,
    updatedAt: settings.updatedAt.toISOString()
  };
}

/**
 * Serializes flat actor metadata for notice actor lookups.
 *
 * @param user - Resolved actor user record.
 * @returns Flat author metadata used internally by serializers.
 */
export function serializeNoticeActorMetadata(user: UserRecord) {
  return serializeUserAuthorMetadata(user);
}
