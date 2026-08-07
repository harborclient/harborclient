import type { NoticeStreamEvent } from '#/server/notices/noticeStreamTypes.js';

/**
 * Handle returned from {@link INoticeEventBus.subscribe} for cleanup.
 */
export interface NoticeEventSubscription {
  /**
   * Stops delivery for this subscriber.
   */
  unsubscribe(): void;
}

/**
 * Fan-out bus for compact notice stream events within one process or via Redis.
 */
export interface INoticeEventBus {
  /**
   * Opens underlying connections when the bus is Redis-backed.
   */
  connect(): Promise<void>;

  /**
   * Closes underlying connections.
   */
  disconnect(): Promise<void>;

  /**
   * When true, the bus requires a healthy Redis connection before SSE streams start.
   */
  isRedisBacked(): boolean;

  /**
   * Verifies the bus is ready to accept subscribers.
   *
   * @throws {Error} When Redis is required but unavailable.
   */
  ensureReady(): Promise<void>;

  /**
   * Publishes one notice stream event to interested subscribers.
   *
   * @param event - Compact notice event including routing metadata.
   */
  publish(event: NoticeStreamEvent): Promise<void>;

  /**
   * Subscribes to notice events for one tenant/user pair.
   *
   * @param tenantId - Effective tenant id for the subscriber.
   * @param recipientUserId - Authenticated user id receiving events.
   * @param handler - Callback invoked for each matching event.
   * @returns Subscription handle for cleanup.
   */
  subscribe(
    tenantId: string,
    recipientUserId: string,
    handler: (event: NoticeStreamEvent) => void
  ): NoticeEventSubscription;
}
