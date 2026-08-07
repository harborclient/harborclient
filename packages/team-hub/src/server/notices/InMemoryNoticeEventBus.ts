import { EventEmitter } from 'node:events';
import type { INoticeEventBus, NoticeEventSubscription } from '#/server/notices/INoticeEventBus.js';
import type { NoticeStreamEvent } from '#/server/notices/noticeStreamTypes.js';

/**
 * Builds the in-process routing key for one notice stream subscriber.
 *
 * @param tenantId - Effective tenant id.
 * @param recipientUserId - Authenticated user id.
 * @returns Routing key used by the in-memory bus.
 */
function subscriberKey(tenantId: string, recipientUserId: string): string {
  return `${tenantId}:${recipientUserId}`;
}

/**
 * Process-local notice event bus backed by {@link EventEmitter}.
 *
 * Suitable for development and single-process Docker deployments.
 */
export class InMemoryNoticeEventBus implements INoticeEventBus {
  private readonly emitter = new EventEmitter();

  /**
   * In-memory mode has no external connections to open.
   */
  async connect(): Promise<void> {}

  /**
   * In-memory mode has no external connections to close.
   */
  async disconnect(): Promise<void> {}

  /**
   * In-memory mode does not require Redis.
   */
  isRedisBacked(): boolean {
    return false;
  }

  /**
   * In-memory mode is always ready.
   */
  async ensureReady(): Promise<void> {}

  /**
   * Emits one notice event to subscribers on the matching routing key.
   *
   * @param event - Compact notice event including routing metadata.
   */
  async publish(event: NoticeStreamEvent): Promise<void> {
    this.emitter.emit(subscriberKey(event.tenantId, event.recipientUserId), event);
  }

  /**
   * Registers a handler for one tenant/user subscriber pair.
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
  ): NoticeEventSubscription {
    const key = subscriberKey(tenantId, recipientUserId);
    this.emitter.on(key, handler);
    return {
      unsubscribe: () => {
        this.emitter.off(key, handler);
      }
    };
  }
}
