import { describe, expect, it } from 'vitest';
import { DiscussionCommentParentError } from '#/db/discussionCommentErrors.js';
import {
  assertDiscussionParentValid,
  isDiscussionCommentTombstoned,
  prepareDiscussionCommentInsert,
  resolveDiscussionPlacement
} from '#/db/discussionCommentLogic.js';
import type { DiscussionCommentRecord } from '#/db/types.js';

/**
 * Builds a minimal discussion comment record for logic tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns Discussion comment record fixture.
 */
function sampleComment(overrides: Partial<DiscussionCommentRecord> = {}): DiscussionCommentRecord {
  return {
    id: 'comment-1',
    targetEntityType: 'request',
    targetEntityId: 'request-1',
    parentCommentId: null,
    rootCommentId: 'comment-1',
    depth: 1,
    body: 'Hello',
    bodyFormat: 'plaintext',
    bodyMetadata: null,
    authorUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    tombstonedAt: null,
    tombstonedByUserId: null,
    ...overrides
  };
}

describe('resolveDiscussionPlacement', () => {
  it('creates depth-1 top-level comments', () => {
    expect(resolveDiscussionPlacement({ commentId: 'new-1', parent: null })).toEqual({
      parentCommentId: null,
      rootCommentId: 'new-1',
      depth: 1
    });
  });

  it('creates depth-2 replies under depth-1 parents', () => {
    const parent = sampleComment({ id: 'root-1', depth: 1, rootCommentId: 'root-1' });

    expect(resolveDiscussionPlacement({ commentId: 'reply-1', parent })).toEqual({
      parentCommentId: 'root-1',
      rootCommentId: 'root-1',
      depth: 2
    });
  });

  it('creates depth-3 replies under depth-2 parents', () => {
    const parent = sampleComment({
      id: 'reply-1',
      depth: 2,
      parentCommentId: 'root-1',
      rootCommentId: 'root-1'
    });

    expect(resolveDiscussionPlacement({ commentId: 'reply-2', parent })).toEqual({
      parentCommentId: 'reply-1',
      rootCommentId: 'root-1',
      depth: 3
    });
  });

  it('flattens replies to depth-3 siblings under the depth-2 parent', () => {
    const parent = sampleComment({
      id: 'reply-2',
      depth: 3,
      parentCommentId: 'reply-1',
      rootCommentId: 'root-1'
    });

    expect(resolveDiscussionPlacement({ commentId: 'reply-3', parent })).toEqual({
      parentCommentId: 'reply-1',
      rootCommentId: 'root-1',
      depth: 3
    });
  });
});

describe('prepareDiscussionCommentInsert', () => {
  it('rejects missing parents referenced by id', () => {
    expect(() =>
      prepareDiscussionCommentInsert(
        {
          targetEntityType: 'request',
          targetEntityId: 'request-1',
          body: 'Reply',
          parentCommentId: 'missing-parent'
        },
        'user-1',
        null,
        'new-comment',
        new Date('2026-01-02T00:00:00.000Z')
      )
    ).toThrow(DiscussionCommentParentError);
  });

  it('never produces depth greater than three', () => {
    const depthThree = sampleComment({
      id: 'depth-3',
      depth: 3,
      parentCommentId: 'depth-2',
      rootCommentId: 'root-1'
    });

    const prepared = prepareDiscussionCommentInsert(
      {
        targetEntityType: 'request',
        targetEntityId: 'request-1',
        body: 'Flattened',
        parentCommentId: depthThree.id
      },
      'user-1',
      depthThree,
      'new-depth-3',
      new Date('2026-01-02T00:00:00.000Z')
    );

    expect(prepared.depth).toBe(3);
    expect(prepared.parentCommentId).toBe('depth-2');
  });
});

describe('assertDiscussionParentValid', () => {
  it('rejects replies to tombstoned parents', () => {
    const parent = sampleComment({ tombstonedAt: new Date('2026-01-03T00:00:00.000Z') });

    expect(() => assertDiscussionParentValid(parent, 'request', 'request-1')).toThrow(
      DiscussionCommentParentError
    );
  });

  it('rejects parents attached to a different target entity', () => {
    const parent = sampleComment({ targetEntityId: 'request-2' });

    expect(() => assertDiscussionParentValid(parent, 'request', 'request-1')).toThrow(
      DiscussionCommentParentError
    );
  });
});

describe('isDiscussionCommentTombstoned', () => {
  it('returns true when tombstone metadata is present', () => {
    expect(
      isDiscussionCommentTombstoned(
        sampleComment({ tombstonedAt: new Date('2026-01-03T00:00:00.000Z') })
      )
    ).toBe(true);
  });
});
