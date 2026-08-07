import { describe, expect, it } from 'vitest';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import {
  NOTICE_STREAM_EVENT_VERSION,
  type NoticeStreamEvent
} from '#/server/notices/noticeStreamTypes.js';

/**
 * Builds a sample notice stream event for bus tests.
 *
 * @param overrides - Partial event fields to override defaults.
 * @returns Notice stream event fixture.
 */
function sampleEvent(overrides: Partial<NoticeStreamEvent> = {}): NoticeStreamEvent {
  return {
    v: NOTICE_STREAM_EVENT_VERSION,
    type: 'notice.created',
    tenantId: '__default__',
    recipientUserId: 'user-1',
    noticeId: 'notice-1',
    unreadCount: 2,
    ...overrides
  };
}

describe('InMemoryNoticeEventBus', () => {
  it('delivers published events to matching subscribers only', async () => {
    const bus = new InMemoryNoticeEventBus();
    const received: NoticeStreamEvent[] = [];
    const other: NoticeStreamEvent[] = [];

    bus.subscribe('__default__', 'user-1', (event) => {
      received.push(event);
    });
    bus.subscribe('__default__', 'user-2', (event) => {
      other.push(event);
    });

    await bus.publish(sampleEvent());
    await bus.publish(sampleEvent({ recipientUserId: 'user-2', noticeId: 'notice-2' }));

    expect(received).toHaveLength(1);
    expect(received[0]?.noticeId).toBe('notice-1');
    expect(other).toHaveLength(1);
    expect(other[0]?.noticeId).toBe('notice-2');
  });

  it('stops delivery after unsubscribe', async () => {
    const bus = new InMemoryNoticeEventBus();
    const received: NoticeStreamEvent[] = [];
    const subscription = bus.subscribe('__default__', 'user-1', (event) => {
      received.push(event);
    });

    await bus.publish(sampleEvent());
    subscription.unsubscribe();
    await bus.publish(sampleEvent({ noticeId: 'notice-2' }));

    expect(received).toHaveLength(1);
  });
});
