import type { TeamHubDiscussionComment } from '@harborclient/core/types';

/**
 * Discussion comment with nested replies for rendering up to three levels.
 */
export interface DiscussionTreeNode {
  /**
   * Underlying comment record from the Team Hub API.
   */
  comment: TeamHubDiscussionComment;

  /**
   * Direct child replies sorted by creation time.
   */
  replies: DiscussionTreeNode[];
}

/** Maximum nesting depth rendered in the Discuss UI. */
export const DISCUSSION_MAX_RENDER_DEPTH = 3;

/**
 * Builds a nested comment tree from a flat Team Hub discussion list.
 *
 * Comments deeper than {@link DISCUSSION_MAX_RENDER_DEPTH} are attached as
 * siblings under their depth-2 ancestor to mirror server flattening rules.
 *
 * @param comments - Flat discussion comments returned by the list API.
 * @returns Root-level nodes with nested replies.
 */
export function buildDiscussionTree(comments: TeamHubDiscussionComment[]): DiscussionTreeNode[] {
  const byId = new Map<string, DiscussionTreeNode>();
  for (const comment of comments) {
    byId.set(comment.id, { comment, replies: [] });
  }

  const roots: DiscussionTreeNode[] = [];

  for (const comment of comments) {
    const node = byId.get(comment.id);
    if (node == null) {
      continue;
    }

    if (comment.parentCommentId == null) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(comment.parentCommentId);
    if (parent == null) {
      roots.push(node);
      continue;
    }

    parent.replies.push(node);
  }

  /**
   * Sorts nodes and descendants chronologically for stable display order.
   *
   * @param nodes - Sibling nodes to sort in place.
   */
  const sortNodes = (nodes: DiscussionTreeNode[]): void => {
    nodes.sort((left, right) => left.comment.createdAt.localeCompare(right.comment.createdAt));
    for (const node of nodes) {
      sortNodes(node.replies);
    }
  };

  sortNodes(roots);
  return roots;
}

/**
 * Returns the placeholder body shown for tombstoned discussion comments.
 *
 * @param comment - Discussion comment record from the Team Hub API.
 * @returns `[deleted]` when tombstoned; otherwise the stored body or empty string.
 */
export function discussionCommentBodyText(comment: TeamHubDiscussionComment): string {
  if (comment.tombstoned) {
    return '[deleted]';
  }

  if (comment.body != null && comment.body.length > 0) {
    return comment.body;
  }

  if (comment.bodyFormat === 'encrypted' || comment.encryptedPayload != null) {
    return '[Encrypted comment]';
  }

  return '[deleted]';
}
