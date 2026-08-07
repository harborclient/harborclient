import { describe, expect, it } from 'vitest';
import { parseMentionedUserIds } from '#/db/parseMentions.js';
import type { UserRecord } from '#/db/types.js';

/**
 * Builds a minimal user record for mention parsing tests.
 *
 * @param id - User id.
 * @param name - Display name used for @mentions.
 * @returns User record fixture.
 */
function sampleUser(id: string, name: string): UserRecord {
  return {
    id,
    name,
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
    avatarInitials: 'TU',
    avatarColor: 'sky-600'
  };
}

describe('parseMentionedUserIds', () => {
  it('matches @username tokens case-insensitively', () => {
    const users = [sampleUser('user-2', 'alice')];
    expect(parseMentionedUserIds('Please review @Alice', users)).toEqual(['user-2']);
  });

  it('matches display names containing spaces', () => {
    const users = [sampleUser('user-2', 'Jane Doe')];
    expect(parseMentionedUserIds('Hi @Jane Doe — thoughts?', users)).toEqual(['user-2']);
  });

  it('returns unique mentioned user ids', () => {
    const users = [sampleUser('user-2', 'alice')];
    expect(parseMentionedUserIds('@alice and @Alice again', users)).toEqual(['user-2']);
  });
});
