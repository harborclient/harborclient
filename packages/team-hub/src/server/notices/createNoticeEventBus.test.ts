import { describe, expect, it } from 'vitest';
import {
  createNoticeEventBusForMode,
  resolveNoticeEventBusMode
} from '#/server/notices/createNoticeEventBus.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import { RedisNoticeEventBus } from '#/server/notices/RedisNoticeEventBus.js';

describe('createNoticeEventBus', () => {
  it('defaults to in-memory fan-out', () => {
    expect(resolveNoticeEventBusMode({ host: '127.0.0.1', port: 6379 })).toBe('memory');
    expect(createNoticeEventBusForMode('memory', { host: '127.0.0.1', port: 6379 })).toBeInstanceOf(
      InMemoryNoticeEventBus
    );
  });

  it('enables Redis pub/sub when noticeEventsPubSub is true', () => {
    expect(
      resolveNoticeEventBusMode({
        host: '127.0.0.1',
        port: 6379,
        noticeEventsPubSub: true
      })
    ).toBe('redis');
    expect(
      createNoticeEventBusForMode('redis', {
        host: '127.0.0.1',
        port: 6379,
        noticeEventsPubSub: true
      })
    ).toBeInstanceOf(RedisNoticeEventBus);
  });
});
