import type { JSX } from 'react';
import type { DiscussionTreeNode } from './buildDiscussionTree';
import { DiscussionCommentRow } from './DiscussionCommentRow';

interface Props {
  /**
   * Team Hub connection id backing the discussion entity.
   */
  hubId: string;

  /**
   * Root-level discussion nodes to render.
   */
  tree: DiscussionTreeNode[];

  /**
   * Disables row actions while a mutation is in flight.
   */
  disabled?: boolean;

  /**
   * Creates a reply under a comment.
   *
   * @param parentCommentId - Parent comment UUID.
   * @param body - Reply body text.
   */
  onReply: (parentCommentId: string, body: string) => Promise<void>;

  /**
   * Updates a comment body.
   *
   * @param commentId - Comment UUID.
   * @param body - Replacement body text.
   */
  onUpdate: (commentId: string, body: string) => Promise<void>;

  /**
   * Tombstones a comment by id.
   *
   * @param commentId - Comment UUID.
   */
  onDelete: (commentId: string) => Promise<void>;
}

/**
 * Renders the root comments in a Team Hub discussion thread.
 */
export function DiscussionThreadList({
  hubId,
  tree,
  disabled = false,
  onReply,
  onUpdate,
  onDelete
}: Props): JSX.Element {
  if (tree.length === 0) {
    return <p className="m-0 text-muted">No comments yet. Start the discussion below.</p>;
  }

  return (
    <div className="space-y-4">
      {tree.map((node) => (
        <DiscussionCommentRow
          key={node.comment.id}
          hubId={hubId}
          node={node}
          disabled={disabled}
          onReply={onReply}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
