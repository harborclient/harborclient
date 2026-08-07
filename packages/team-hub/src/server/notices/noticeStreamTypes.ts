/**
 * Wire format version for notice SSE payloads.
 */
export const NOTICE_STREAM_EVENT_VERSION = 1 as const;

/**
 * Compact notice event kinds delivered over SSE.
 */
export type NoticeStreamEventType = 'notice.created';

/**
 * Compact notice event broadcast to authenticated SSE subscribers.
 *
 * Tenant and recipient are used for fan-out routing; they are omitted from the
 * SSE `data:` line sent to clients.
 */
export interface NoticeStreamEvent {
  /**
   * Payload schema version for forward-compatible clients.
   */
  v: typeof NOTICE_STREAM_EVENT_VERSION;

  /**
   * Notice event kind.
   */
  type: NoticeStreamEventType;

  /**
   * Tenant namespace for the notice row.
   */
  tenantId: string;

  /**
   * User id that should receive the event.
   */
  recipientUserId: string;

  /**
   * Stable notice identifier.
   */
  noticeId: string;

  /**
   * Unread notice count for the recipient after this event.
   */
  unreadCount: number;
}

/**
 * Client-visible subset of {@link NoticeStreamEvent} written to SSE streams.
 */
export interface NoticeStreamClientPayload {
  /**
   * Payload schema version.
   */
  v: typeof NOTICE_STREAM_EVENT_VERSION;

  /**
   * Notice event kind.
   */
  type: NoticeStreamEventType;

  /**
   * Stable notice identifier.
   */
  noticeId: string;

  /**
   * Unread notice count for the authenticated user after this event.
   */
  unreadCount: number;
}

/**
 * Redis pub/sub channel carrying {@link NoticeStreamEvent} JSON payloads.
 */
export const NOTICE_STREAM_REDIS_CHANNEL = 'teamhub:notice-events';

/**
 * Serializes a notice stream event for SSE `data:` frames.
 *
 * @param event - Internal fan-out event.
 * @returns Compact JSON payload for connected clients.
 */
export function serializeNoticeStreamClientPayload(
  event: NoticeStreamEvent
): NoticeStreamClientPayload {
  return {
    v: event.v,
    type: event.type,
    noticeId: event.noticeId,
    unreadCount: event.unreadCount
  };
}
