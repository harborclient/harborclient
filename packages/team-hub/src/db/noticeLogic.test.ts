import { describe, expect, it } from 'vitest';
import {
  filterAccessibleNotices,
  isSelfNotice,
  listCollectionNoticeRecipients,
  shouldDeliverNotice
} from '#/db/noticeLogic.js';
import type { NoticeRecord, UserRecord } from '#/db/types.js';

/**
 * Builds a user record fixture for notice logic tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns User record fixture.
 */
function sampleUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    name: 'User one',
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
    avatarInitials: 'UO',
    avatarColor: 'sky-600',
    avatarImage: null,
    avatarImageMime: null,
    avatarImageUpdatedAt: null,
    ...overrides
  };
}

/**
 * Builds a notice record fixture for access filtering tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Notice record fixture.
 */
function sampleNotice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
  return {
    id: 'notice-1',
    recipientUserId: 'user-2',
    eventType: 'request.updated',
    entityType: 'request',
    entityId: 'request-1',
    requestId: 'request-1',
    collectionId: 'collection-1',
    folderId: null,
    runResultId: null,
    discussionThreadId: null,
    discussionCommentId: null,
    actorUserId: 'user-1',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    readAt: null,
    displayMetadata: {
      actorName: 'User one',
      targetLabel: 'Get users'
    },
    ...overrides
  };
}

describe('shouldDeliverNotice', () => {
  it('delivers all notice reasons when level is all', () => {
    expect(shouldDeliverNotice('all', 'mention')).toBe(true);
    expect(shouldDeliverNotice('all', 'thread_subscription')).toBe(true);
    expect(shouldDeliverNotice('all', 'entity_activity')).toBe(true);
  });

  it('delivers only mentions when level is mentions', () => {
    expect(shouldDeliverNotice('mentions', 'mention')).toBe(true);
    expect(shouldDeliverNotice('mentions', 'thread_subscription')).toBe(false);
  });

  it('suppresses all notices when level is none', () => {
    expect(shouldDeliverNotice('none', 'mention')).toBe(false);
  });
});

describe('isSelfNotice', () => {
  it('detects self-noise', () => {
    expect(isSelfNotice('user-1', 'user-1')).toBe(true);
    expect(isSelfNotice('user-1', 'user-2')).toBe(false);
  });
});

describe('listCollectionNoticeRecipients', () => {
  it('excludes the actor and users without collection access', () => {
    const users = [
      sampleUser({ id: 'actor', collectionAccess: ['collection-1'] }),
      sampleUser({ id: 'peer', collectionAccess: ['collection-1'] }),
      sampleUser({ id: 'outsider', collectionAccess: ['collection-2'] })
    ];

    const recipients = listCollectionNoticeRecipients(users, 'collection-1', 'actor');
    expect(recipients.map((user) => user.id)).toEqual(['peer']);
  });
});

describe('filterAccessibleNotices', () => {
  it('drops notices for collections the recipient cannot access', () => {
    const user = sampleUser({ id: 'user-2', collectionAccess: ['collection-2'] });
    const notices = [sampleNotice()];

    expect(filterAccessibleNotices(user, notices)).toEqual([]);
  });

  it('keeps notices for accessible collection-scoped entities', () => {
    const user = sampleUser({ id: 'user-2', collectionAccess: ['collection-1'] });
    const notices = [sampleNotice()];

    expect(filterAccessibleNotices(user, notices)).toHaveLength(1);
  });
});
