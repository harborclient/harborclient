import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { RedisNoticeEventBus } from '#/server/notices/RedisNoticeEventBus.js';
import {
  NOTICE_STREAM_EVENT_VERSION,
  NOTICE_STREAM_REDIS_CHANNEL,
  type NoticeStreamEvent
} from '#/server/notices/noticeStreamTypes.js';

/**
 * Shared Redis pub/sub backbone used to unit test notice fan-out.
 */
class FakeRedisBackbone {
  private readonly emitter = new EventEmitter();

  /**
   * Creates a fake Redis client wired to the shared backbone.
   */
  createClient(): {
    connected: boolean;
    connect(): Promise<void>;
    quit(): Promise<'OK'>;
    ping(): Promise<string>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string): Promise<number>;
    unsubscribe(channel: string): Promise<number>;
    on(event: 'message', listener: (channel: string, message: string) => void): void;
    off(event: 'message', listener: (channel: string, message: string) => void): void;
  } {
    const client = {
      connected: false,
      connect: async (): Promise<void> => {
        client.connected = true;
      },
      quit: async (): Promise<'OK'> => {
        client.connected = false;
        return 'OK';
      },
      ping: async (): Promise<string> => 'PONG',
      publish: async (channel: string, message: string): Promise<number> => {
        this.emitter.emit('message', channel, message);
        return 1;
      },
      subscribe: async (): Promise<number> => 1,
      unsubscribe: async (): Promise<number> => 1,
      on: (event: 'message', listener: (channel: string, message: string) => void): void => {
        this.emitter.on(event, listener);
      },
      off: (event: 'message', listener: (channel: string, message: string) => void): void => {
        this.emitter.off(event, listener);
      }
    };

    return client;
  }
}

describe('RedisNoticeEventBus', () => {
  it('routes Redis pub/sub payloads to matching local subscribers', async () => {
    const backbone = new FakeRedisBackbone();
    const publisher = backbone.createClient();
    const subscriber = backbone.createClient();
    const bus = new RedisNoticeEventBus(publisher, subscriber);
    await bus.connect();

    const received: NoticeStreamEvent[] = [];
    bus.subscribe('__default__', 'user-1', (event) => {
      received.push(event);
    });

    const payload: NoticeStreamEvent = {
      v: NOTICE_STREAM_EVENT_VERSION,
      type: 'notice.created',
      tenantId: '__default__',
      recipientUserId: 'user-1',
      noticeId: 'notice-1',
      unreadCount: 4
    };

    await publisher.publish(NOTICE_STREAM_REDIS_CHANNEL, JSON.stringify(payload));

    expect(received).toEqual([payload]);
  });
});
