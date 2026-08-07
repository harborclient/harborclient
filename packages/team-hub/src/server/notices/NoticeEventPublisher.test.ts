import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import { NoticeEventPublisher } from '#/server/notices/NoticeEventPublisher.js';
import type { NoticeRecord } from '#/db/types.js';

describe('NoticeEventPublisher', () => {
  it('publishes notice.created events with unread counts', async () => {
    const db = createStubDatabase();
    db.getTenantId.mockReturnValue('__default__');
    db.countUnreadNotices.mockResolvedValue(3);

    const bus = new InMemoryNoticeEventBus();
    const received: unknown[] = [];
    bus.subscribe('__default__', 'user-1', (event) => {
      received.push(event);
    });

    const publisher = new NoticeEventPublisher(db, bus);
    const record: NoticeRecord = {
      id: 'notice-1',
      recipientUserId: 'user-1',
      eventType: 'discussion.mention',
      entityType: 'request',
      entityId: 'request-1',
      requestId: 'request-1',
      collectionId: 'collection-1',
      folderId: null,
      runResultId: null,
      discussionThreadId: 'thread-1',
      discussionCommentId: 'comment-1',
      actorUserId: 'user-2',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      readAt: null,
      displayMetadata: {
        actorName: 'Peer',
        targetLabel: 'Get users'
      }
    };

    await publisher.publishCreatedNotices([record]);

    expect(db.countUnreadNotices).toHaveBeenCalledWith('user-1');
    expect(received).toEqual([
      {
        v: 1,
        type: 'notice.created',
        tenantId: '__default__',
        recipientUserId: 'user-1',
        noticeId: 'notice-1',
        unreadCount: 3
      }
    ]);
  });
});
