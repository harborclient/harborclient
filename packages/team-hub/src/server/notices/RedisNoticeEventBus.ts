import Redis from 'ioredis';
import { redisSectionSchema } from '#/config/serverConfig.schema.js';
import { formatZodError } from '#/db/validation.js';
import type { INoticeEventBus, NoticeEventSubscription } from '#/server/notices/INoticeEventBus.js';
import {
  NOTICE_STREAM_REDIS_CHANNEL,
  NOTICE_STREAM_EVENT_VERSION,
  type NoticeStreamEvent
} from '#/server/notices/noticeStreamTypes.js';

/**
 * Minimal Redis pub/sub client surface used by {@link RedisNoticeEventBus}.
 */
interface RedisPubSubClient {
  /**
   * Opens the Redis connection.
   */
  connect(): Promise<void>;

  /**
   * Closes the Redis connection.
   */
  quit(): Promise<'OK' | undefined>;

  /**
   * Verifies Redis connectivity.
   */
  ping(): Promise<string>;

  /**
   * Publishes a message to a channel.
   */
  publish(channel: string, message: string): Promise<number>;

  /**
   * Subscribes to a channel.
   */
  subscribe(channel: string): Promise<number>;

  /**
   * Unsubscribes from a channel.
   */
  unsubscribe(channel: string): Promise<number>;

  /**
   * Registers a message callback.
   */
  on(event: 'message', listener: (channel: string, message: string) => void): void;

  /**
   * Removes a message callback.
   */
  off(event: 'message', listener: (channel: string, message: string) => void): void;
}

/**
 * Redis-backed notice event bus for multi-instance Team Hub deployments.
 */
export class RedisNoticeEventBus implements INoticeEventBus {
  private readonly publisher: RedisPubSubClient;
  private readonly subscriber: RedisPubSubClient;
  private readonly listeners = new Map<string, Set<(event: NoticeStreamEvent) => void>>();
  private connected = false;

  /**
   * Creates a Redis notice event bus from publisher and subscriber clients.
   *
   * @param publisher - Redis client used for PUBLISH.
   * @param subscriber - Dedicated Redis client used for SUBSCRIBE.
   */
  constructor(publisher: RedisPubSubClient, subscriber: RedisPubSubClient) {
    this.publisher = publisher;
    this.subscriber = subscriber;
    this.subscriber.on('message', this.handleRedisMessage);
  }

  /**
   * Validates raw config and constructs a {@link RedisNoticeEventBus}.
   *
   * @param config - Raw `redis` section from server.yaml.
   * @returns Configured Redis notice event bus instance.
   * @throws {Error} When config fails Redis-specific validation.
   */
  static fromConfig(config: unknown): RedisNoticeEventBus {
    const parsed = redisSectionSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    const options = {
      host: parsed.data.host,
      port: parsed.data.port,
      ...(parsed.data.password ? { password: parsed.data.password } : {}),
      ...(parsed.data.db != null ? { db: parsed.data.db } : {})
    };

    const publisher = new Redis(options) as unknown as RedisPubSubClient;
    const subscriber = new Redis(options) as unknown as RedisPubSubClient;
    return new RedisNoticeEventBus(publisher, subscriber);
  }

  /**
   * Opens Redis publisher and subscriber connections.
   */
  async connect(): Promise<void> {
    await this.publisher.connect();
    await this.subscriber.connect();
    await this.subscriber.subscribe(NOTICE_STREAM_REDIS_CHANNEL);
    this.connected = true;
  }

  /**
   * Closes Redis publisher and subscriber connections.
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    await this.subscriber.quit();
    await this.publisher.quit();
  }

  /**
   * Redis pub/sub mode requires a healthy Redis connection.
   */
  isRedisBacked(): boolean {
    return true;
  }

  /**
   * Verifies Redis connectivity before opening SSE streams.
   *
   * @throws {Error} When Redis is unavailable.
   */
  async ensureReady(): Promise<void> {
    if (!this.connected) {
      throw new Error('Notice event bus is not connected.');
    }

    await this.publisher.ping();
  }

  /**
   * Publishes one notice event to the shared Redis channel.
   *
   * @param event - Compact notice event including routing metadata.
   */
  async publish(event: NoticeStreamEvent): Promise<void> {
    await this.publisher.publish(NOTICE_STREAM_REDIS_CHANNEL, JSON.stringify(event));
  }

  /**
   * Registers a local handler filtered by tenant and recipient user id.
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
    const key = `${tenantId}:${recipientUserId}`;
    const handlers = this.listeners.get(key) ?? new Set();
    handlers.add(handler);
    this.listeners.set(key, handlers);

    return {
      unsubscribe: () => {
        const current = this.listeners.get(key);
        if (!current) {
          return;
        }
        current.delete(handler);
        if (current.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Parses Redis pub/sub payloads and forwards them to matching local handlers.
   *
   * @param channel - Redis channel name.
   * @param message - JSON-encoded {@link NoticeStreamEvent}.
   */
  private handleRedisMessage = (channel: string, message: string): void => {
    if (channel !== NOTICE_STREAM_REDIS_CHANNEL) {
      return;
    }

    let event: NoticeStreamEvent;
    try {
      const parsed: unknown = JSON.parse(message);
      if (!isNoticeStreamEvent(parsed)) {
        return;
      }
      event = parsed;
    } catch {
      return;
    }

    const key = `${event.tenantId}:${event.recipientUserId}`;
    const handlers = this.listeners.get(key);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      handler(event);
    }
  };
}

/**
 * Type guard for compact notice stream events received from Redis.
 *
 * @param value - Parsed JSON value.
 * @returns True when the value matches {@link NoticeStreamEvent}.
 */
function isNoticeStreamEvent(value: unknown): value is NoticeStreamEvent {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.v === NOTICE_STREAM_EVENT_VERSION &&
    record.type === 'notice.created' &&
    typeof record.tenantId === 'string' &&
    typeof record.recipientUserId === 'string' &&
    typeof record.noticeId === 'string' &&
    typeof record.unreadCount === 'number'
  );
}
