/**
 * Wire format version for notice SSE payloads.
 */
export const NOTICE_STREAM_EVENT_VERSION = 1 as const;

/**
 * Compact notice event kinds delivered over SSE.
 */
export type NoticeStreamEventType = 'notice.created';

/**
 * Compact notice event payload delivered over `GET /notices/stream`.
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
   * Stable notice identifier.
   */
  noticeId: string;

  /**
   * Unread notice count for the authenticated user after this event.
   */
  unreadCount: number;
}

/**
 * Callbacks invoked while a notice SSE stream is active.
 */
export interface NoticeStreamHandlers {
  /**
   * Called once the SSE stream is connected and headers are validated.
   */
  onOpen?: () => void;

  /**
   * Called for each parsed notice stream event.
   *
   * @param event - Compact notice event payload.
   */
  onEvent: (event: NoticeStreamEvent) => void;

  /**
   * Called when the stream ends or fails before an explicit abort.
   *
   * @param error - Failure reason, when available.
   */
  onClose?: (error?: Error) => void;
}
