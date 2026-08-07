import { describe, expect, it } from 'vitest';
import type { DiscussionCommentRecord } from '#/db/types.js';
import {
  PLAINTEXT_DISCUSSION_BODY_REJECTED_MESSAGE,
  rejectsPlaintextDiscussionBody,
  serializeDiscussionBodyForClient
} from '#/server/routes/discussionE2eePolicy.js';

const sampleComment: DiscussionCommentRecord = {
  id: 'comment-1',
  targetEntityType: 'request',
  targetEntityId: 'request-1',
  parentCommentId: null,
  rootCommentId: 'comment-1',
  depth: 1,
  body: 'Secret thread',
  bodyFormat: 'plaintext',
  bodyMetadata: null,
  authorUserId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  tombstonedAt: null,
  tombstonedByUserId: null
};

describe('discussionE2eePolicy', () => {
  it('rejects plaintext bodies when E2EE is required', () => {
    expect(rejectsPlaintextDiscussionBody({ e2ee: true })).toBe(true);
    expect(rejectsPlaintextDiscussionBody({ e2ee: false })).toBe(false);
  });

  it('uses a stable plaintext rejection message', () => {
    expect(PLAINTEXT_DISCUSSION_BODY_REJECTED_MESSAGE).toContain('Encrypted payloads are required');
  });

  it('hides encrypted and E2EE-hub plaintext bodies from list responses', () => {
    expect(
      serializeDiscussionBodyForClient(
        { ...sampleComment, bodyFormat: 'encrypted' },
        { e2ee: true }
      )
    ).toBeNull();

    expect(serializeDiscussionBodyForClient(sampleComment, { e2ee: true })).toBeNull();
    expect(serializeDiscussionBodyForClient(sampleComment, { e2ee: false })).toBe('Secret thread');
  });
});
