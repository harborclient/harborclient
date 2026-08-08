import { describe, expect, it } from 'vitest';
import type { UserRecord } from '#/db/types.js';
import {
  serializeDiscussionAuthor,
  serializeUnknownDiscussionAuthor,
  serializeUserAuthorMetadata
} from '#/server/routes/schemas/userAuthor.js';
import { sampleAttribution } from '#/server/routes/test/sampleAttribution.js';

const sampleUser: UserRecord = {
  id: 'user-abc',
  name: 'Alice Example',
  role: 'user',
  collectionAccess: ['*'],
  environmentAccess: ['*'],
  snippetAccess: ['*'],
  liveServerAccess: ['*'],
  livePageAccess: ['*'],
  llmAccess: false,
  llmModels: [],
  llmMonthlyTokenLimit: null,
  avatarInitials: 'AX',
  avatarColor: 'rose-600',
  avatarImage: null,
  avatarImageKey: null,
  avatarImageMime: null,
  avatarImageUpdatedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...sampleAttribution
};

describe('serializeUserAuthorMetadata', () => {
  it('includes flat avatar fields for notice-style responses', () => {
    expect(serializeUserAuthorMetadata(sampleUser)).toEqual({
      id: 'user-abc',
      name: 'Alice Example',
      avatarInitials: 'AX',
      avatarColor: 'rose-600'
    });
  });
});

describe('serializeDiscussionAuthor', () => {
  it('includes nested avatar metadata for discussion responses', () => {
    expect(serializeDiscussionAuthor(sampleUser)).toEqual({
      id: 'user-abc',
      name: 'Alice Example',
      avatar: {
        initials: 'AX',
        color: 'rose-600'
      }
    });
  });
});

describe('serializeUnknownDiscussionAuthor', () => {
  it('returns minimal metadata without avatar presentation', () => {
    expect(serializeUnknownDiscussionAuthor('missing-user')).toEqual({
      id: 'missing-user',
      name: 'Unknown user'
    });
    expect(serializeUnknownDiscussionAuthor(null)).toEqual({
      id: '',
      name: 'Unknown user'
    });
  });
});
