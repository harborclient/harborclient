import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { NoticeRecord } from '#/db/types.js';
import {
  authHeader,
  createProtectedTestApp,
  sampleUserRecord
} from '#/server/routes/test/createTestApp.js';

/**
 * Builds a notice record fixture for route tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Notice record fixture.
 */
function sampleNotice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
  return {
    id: 'notice-1',
    recipientUserId: 'user-1',
    eventType: 'discussion.mention',
    entityType: 'request',
    entityId: 'request-1',
    requestId: 'request-1',
    collectionId: 'collection-1',
    folderId: null,
    runResultId: null,
    discussionThreadId: 'comment-1',
    discussionCommentId: 'comment-2',
    actorUserId: 'user-2',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    readAt: null,
    displayMetadata: {
      actorName: 'Peer',
      targetLabel: 'Get users',
      method: 'GET',
      previewText: 'Ping @you'
    },
    ...overrides
  };
}

describe('notice routes', () => {
  it('lists notices for the authenticated user', async () => {
    const db = createStubDatabase();
    const notice = sampleNotice();
    db.listNotices.mockResolvedValue({ notices: [notice], nextCursor: null });
    const app = await createProtectedTestApp({ db, withValidAuth: true });
    db.findUserById.mockImplementation(async (userId: string) => {
      if (userId === 'user-2') {
        return {
          ...sampleUserRecord,
          id: 'user-2',
          name: 'Peer'
        };
      }
      return sampleUserRecord;
    });

    const response = await app.inject({
      method: 'GET',
      url: '/notices',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(db.listNotices).toHaveBeenCalledWith({
      recipientUserId: 'user-1',
      cursor: undefined,
      limit: undefined
    });
    expect(response.json().notices[0].actor.name).toBe('Peer');

    await app.close();
  });

  it('returns unread counts', async () => {
    const db = createStubDatabase();
    db.countUnreadNotices.mockResolvedValue(3);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'GET',
      url: '/notices/unread-count',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ count: 3 });

    await app.close();
  });

  it('marks one notice read', async () => {
    const db = createStubDatabase();
    const notice = sampleNotice({ readAt: new Date('2026-01-03T00:00:00.000Z') });
    db.markNoticeRead.mockResolvedValue(notice);
    const app = await createProtectedTestApp({ db, withValidAuth: true });
    db.findUserById.mockImplementation(async (userId: string) => {
      if (userId === 'user-2') {
        return {
          ...sampleUserRecord,
          id: 'user-2',
          name: 'Peer'
        };
      }
      return sampleUserRecord;
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notices/notice-1/read',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(db.markNoticeRead).toHaveBeenCalledWith('notice-1', 'user-1');

    await app.close();
  });

  it('reads and updates notification settings', async () => {
    const db = createStubDatabase();
    db.getUserNotificationSettings.mockResolvedValue({
      userId: 'user-1',
      level: 'mentions',
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });
    db.updateUserNotificationSettings.mockResolvedValue({
      userId: 'user-1',
      level: 'none',
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    });
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const getResponse = await app.inject({
      method: 'GET',
      url: '/me/notification-settings',
      headers: authHeader()
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().level).toBe('mentions');

    const putResponse = await app.inject({
      method: 'PUT',
      url: '/me/notification-settings',
      headers: authHeader(),
      payload: { level: 'none' }
    });
    expect(putResponse.statusCode).toBe(200);
    expect(db.updateUserNotificationSettings).toHaveBeenCalledWith('user-1', 'none');

    await app.close();
  });

  it('subscribes and unsubscribes discussion threads', async () => {
    const db = createStubDatabase();
    db.findDiscussionCommentById.mockResolvedValue({
      id: 'comment-1',
      targetEntityType: 'request',
      targetEntityId: 'request-1',
      parentCommentId: null,
      rootCommentId: 'comment-1',
      depth: 1,
      body: 'Root',
      bodyFormat: 'plaintext',
      bodyMetadata: null,
      authorUserId: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      tombstonedAt: null,
      tombstonedByUserId: null
    });
    db.isSubscribedToDiscussionThread.mockResolvedValue(true);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const subscribeResponse = await app.inject({
      method: 'POST',
      url: '/discussion-threads/comment-1/subscribe',
      headers: authHeader()
    });
    expect(subscribeResponse.statusCode).toBe(200);
    expect(subscribeResponse.json()).toEqual({ subscribed: true, rootCommentId: 'comment-1' });

    const statusResponse = await app.inject({
      method: 'GET',
      url: '/discussion-threads/comment-1/subscription',
      headers: authHeader()
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json().subscribed).toBe(true);

    const unsubscribeResponse = await app.inject({
      method: 'POST',
      url: '/discussion-threads/comment-1/unsubscribe',
      headers: authHeader()
    });
    expect(unsubscribeResponse.statusCode).toBe(200);
    expect(db.unsubscribeDiscussionThread).toHaveBeenCalledWith('user-1', 'comment-1');

    await app.close();
  });
});
