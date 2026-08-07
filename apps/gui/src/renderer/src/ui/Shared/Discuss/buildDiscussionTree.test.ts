import { describe, expect, it } from 'vitest';
import type { TeamHubDiscussionComment } from '@harborclient/core/types';
import { buildDiscussionTree, discussionCommentBodyText } from './buildDiscussionTree';

/**
 * Builds a minimal discussion comment fixture for tree tests.
 *
 * @param overrides - Partial fields to override on the fixture.
 */
function comment(
  overrides: Partial<TeamHubDiscussionComment> & Pick<TeamHubDiscussionComment, 'id' | 'depth'>
): TeamHubDiscussionComment {
  return {
    entityType: 'request',
    entityId: 'req-1',
    parentCommentId: null,
    rootCommentId: overrides.id,
    body: 'hello',
    bodyFormat: 'plaintext',
    author: { id: 'user-1', name: 'Alice' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tombstoned: false,
    ...overrides
  };
}

describe('buildDiscussionTree', () => {
  it('nests replies up to three levels under their parent comments', () => {
    const tree = buildDiscussionTree([
      comment({ id: 'root', depth: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
      comment({
        id: 'reply',
        depth: 2,
        parentCommentId: 'root',
        rootCommentId: 'root',
        createdAt: '2026-01-02T00:00:00.000Z'
      }),
      comment({
        id: 'nested',
        depth: 3,
        parentCommentId: 'reply',
        rootCommentId: 'root',
        createdAt: '2026-01-03T00:00:00.000Z'
      })
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.comment.id).toBe('root');
    expect(tree[0]?.replies[0]?.comment.id).toBe('reply');
    expect(tree[0]?.replies[0]?.replies[0]?.comment.id).toBe('nested');
  });
});

describe('discussionCommentBodyText', () => {
  it('renders tombstoned parents as [deleted] while preserving metadata', () => {
    expect(
      discussionCommentBodyText(comment({ id: 'deleted', depth: 1, tombstoned: true, body: null }))
    ).toBe('[deleted]');
  });

  it('renders undecryptable encrypted comments as [Encrypted comment]', () => {
    expect(
      discussionCommentBodyText(
        comment({
          id: 'encrypted',
          depth: 1,
          body: null,
          bodyFormat: 'encrypted',
          encryptedPayload: {
            ciphertext: 'dGVzdA==',
            mlsGroupId: 'thread:request:req-1',
            epoch: 0,
            senderDeviceId: '550e8400-e29b-41d4-a716-446655440000',
            keyFormat: 'identity-v1'
          }
        })
      )
    ).toBe('[Encrypted comment]');
  });
});
