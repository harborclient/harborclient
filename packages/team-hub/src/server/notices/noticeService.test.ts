import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import type { DiscussionCommentRecord, UserRecord } from '#/db/types.js';
import { NoticeService } from '#/server/notices/noticeService.js';

/**
 * Builds a user record fixture for notice service tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns User record fixture.
 */
function sampleUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    name: 'Actor',
    role: 'user',
    collectionAccess: ['collection-1'],
    environmentAccess: ['*'],
    snippetAccess: ['*'],
    liveServerAccess: ['*'],
    livePageAccess: ['*'],
    llmAccess: false,
    llmModels: [],
    llmMonthlyTokenLimit: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdByUserId: null,
    updatedByUserId: null,
    avatarInitials: 'AC',
    avatarColor: 'sky-600',
    ...overrides
  };
}

describe('NoticeService', () => {
  it('does not create self notices for request updates', async () => {
    const db = createStubDatabase();
    const actor = sampleUser({ id: 'actor' });
    const peer = sampleUser({ id: 'peer', name: 'Peer' });
    db.listUsers.mockResolvedValue([actor, peer]);
    db.getUserNotificationSettings.mockResolvedValue({
      userId: 'peer',
      level: 'all',
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    const service = new NoticeService(db);
    await service.createNoticesForRequestUpdate(
      {
        id: 'request-1',
        collectionId: 'collection-1',
        name: 'Get users',
        protocol: 'http',
        method: 'GET',
        url: 'https://example.test/users',
        headers: [],
        params: [],
        auth: { type: 'none', basic: { username: '', password: '' }, bearer: { token: '' } },
        body: '',
        bodyType: 'none',
        preRequestScript: '',
        postRequestScript: '',
        comment: '',
        folderId: null,
        sortOrder: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        createdByUserId: 'actor',
        updatedByUserId: 'actor',
        marker: null
      },
      actor
    );

    expect(db.createNotices).toHaveBeenCalledTimes(1);
    const inputs = db.createNotices.mock.calls[0]?.[0] ?? [];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.recipientUserId).toBe('peer');
    expect(inputs[0]?.eventType).toBe('request.updated');
  });

  it('creates mention notices under the mentions notification level', async () => {
    const db = createStubDatabase();
    const actor = sampleUser({ id: 'actor', name: 'Actor' });
    const mentioned = sampleUser({ id: 'mentioned', name: 'Mentioned' });
    db.listUsers.mockResolvedValue([actor, mentioned]);
    db.getUserNotificationSettings.mockImplementation(async (userId: string) => ({
      userId,
      level: userId === 'mentioned' ? 'mentions' : 'none',
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    }));
    db.listDiscussionThreadSubscribers.mockResolvedValue([]);
    db.findRequestById.mockResolvedValue({
      id: 'request-1',
      collectionId: 'collection-1',
      name: 'Get users',
      protocol: 'http',
      method: 'GET',
      url: 'https://example.test/users',
      headers: [],
      params: [],
      auth: { type: 'none', basic: { username: '', password: '' }, bearer: { token: '' } },
      body: '',
      bodyType: 'none',
      preRequestScript: '',
      postRequestScript: '',
      comment: '',
      folderId: null,
      sortOrder: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdByUserId: 'actor',
      updatedByUserId: 'actor',
      marker: null
    });

    const comment: DiscussionCommentRecord = {
      id: 'comment-1',
      targetEntityType: 'request',
      targetEntityId: 'request-1',
      parentCommentId: null,
      rootCommentId: 'comment-1',
      depth: 1,
      body: 'Ping @Mentioned',
      bodyFormat: 'plaintext',
      bodyMetadata: null,
      authorUserId: 'actor',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      tombstonedAt: null,
      tombstonedByUserId: null
    };

    const service = new NoticeService(db);
    await service.createNoticesForDiscussionComment(comment, null, actor);

    expect(db.subscribeDiscussionThread).toHaveBeenCalledWith('actor', 'comment-1');
    expect(db.subscribeDiscussionThread).toHaveBeenCalledWith('mentioned', 'comment-1');
    const inputs = db.createNotices.mock.calls[0]?.[0] ?? [];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.recipientUserId).toBe('mentioned');
    expect(inputs[0]?.eventType).toBe('discussion.mention');
  });

  it('notifies parent comment authors and thread subscribers on replies', async () => {
    const db = createStubDatabase();
    const actor = sampleUser({ id: 'actor', name: 'Actor' });
    const parentAuthor = sampleUser({ id: 'parent-author', name: 'Parent' });
    const subscriber = sampleUser({
      id: 'subscriber',
      name: 'Subscriber',
      collectionAccess: ['collection-1']
    });
    db.listUsers.mockResolvedValue([actor, parentAuthor, subscriber]);
    db.getUserNotificationSettings.mockImplementation(async (userId: string) => ({
      userId,
      level: 'all',
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    }));
    db.listDiscussionThreadSubscribers.mockResolvedValue(['subscriber']);
    db.findRequestById.mockResolvedValue({
      id: 'request-1',
      collectionId: 'collection-1',
      name: 'Get users',
      protocol: 'http',
      method: 'GET',
      url: 'https://example.test/users',
      headers: [],
      params: [],
      auth: { type: 'none', basic: { username: '', password: '' }, bearer: { token: '' } },
      body: '',
      bodyType: 'none',
      preRequestScript: '',
      postRequestScript: '',
      comment: '',
      folderId: null,
      sortOrder: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdByUserId: 'actor',
      updatedByUserId: 'actor',
      marker: null
    });

    const parent: DiscussionCommentRecord = {
      id: 'parent-1',
      targetEntityType: 'request',
      targetEntityId: 'request-1',
      parentCommentId: null,
      rootCommentId: 'parent-1',
      depth: 1,
      body: 'Root',
      bodyFormat: 'plaintext',
      bodyMetadata: null,
      authorUserId: 'parent-author',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      tombstonedAt: null,
      tombstonedByUserId: null
    };

    const reply: DiscussionCommentRecord = {
      id: 'reply-1',
      targetEntityType: 'request',
      targetEntityId: 'request-1',
      parentCommentId: 'parent-1',
      rootCommentId: 'parent-1',
      depth: 2,
      body: 'Reply',
      bodyFormat: 'plaintext',
      bodyMetadata: null,
      authorUserId: 'actor',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      tombstonedAt: null,
      tombstonedByUserId: null
    };

    const service = new NoticeService(db);
    await service.createNoticesForDiscussionComment(reply, parent, actor);

    const recipientIds = (db.createNotices.mock.calls[0]?.[0] ?? []).map(
      (input) => input.recipientUserId
    );
    expect(recipientIds.sort()).toEqual(['parent-author', 'subscriber']);
  });

  it('creates failing run result notices for collection peers', async () => {
    const db = createStubDatabase();
    const actor = sampleUser({ id: 'actor' });
    const peer = sampleUser({ id: 'peer', collectionAccess: ['collection-1'] });
    db.listUsers.mockResolvedValue([actor, peer]);
    db.getUserNotificationSettings.mockResolvedValue({
      userId: 'peer',
      level: 'all',
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });

    const service = new NoticeService(db);
    await service.createNoticesForRunResult(
      {
        id: 'run-1',
        kind: 'collection-run-results',
        label: 'API — 2026-01-02 12:00:00',
        collectionName: 'API',
        requestName: null,
        summary: { passed: 1, failed: 2, skipped: 0 },
        payload: { collection: { id: 'collection-1', name: 'API' } },
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        createdByUserId: 'actor'
      },
      actor,
      'collection-1'
    );

    const inputs = db.createNotices.mock.calls[0]?.[0] ?? [];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.recipientUserId).toBe('peer');
    expect(inputs[0]?.eventType).toBe('runResult.failed');
  });
});
