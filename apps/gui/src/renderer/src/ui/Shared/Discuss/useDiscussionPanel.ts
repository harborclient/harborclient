import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TeamHubDiscussionComment, TeamHubDiscussionTarget } from '@harborclient/core/types';
import { buildDiscussionTree, type DiscussionTreeNode } from './buildDiscussionTree';

/**
 * Mutable discussion panel state and actions.
 */
export interface DiscussionPanelState {
  /**
   * Nested comment tree for rendering.
   */
  tree: DiscussionTreeNode[];

  /**
   * Flat comment list returned by the latest fetch.
   */
  comments: TeamHubDiscussionComment[];

  /**
   * True while the initial or refreshed comment list is loading.
   */
  loading: boolean;

  /**
   * True while a create/update/delete mutation is in flight.
   */
  saving: boolean;

  /**
   * Most recent load or mutation error message.
   */
  error: string | null;

  /**
   * Reloads the discussion thread from the Team Hub.
   */
  refresh: () => Promise<void>;

  /**
   * Creates a root-level comment on the target entity.
   *
   * @param body - Comment text to post.
   */
  postComment: (body: string) => Promise<void>;

  /**
   * Creates a reply to an existing comment.
   *
   * @param parentCommentId - Parent comment UUID.
   * @param body - Reply text to post.
   */
  postReply: (parentCommentId: string, body: string) => Promise<void>;

  /**
   * Updates an existing comment body.
   *
   * @param commentId - Comment UUID.
   * @param body - Replacement body text.
   */
  updateComment: (commentId: string, body: string) => Promise<void>;

  /**
   * Tombstones a comment by id.
   *
   * @param commentId - Comment UUID.
   */
  deleteComment: (commentId: string) => Promise<void>;
}

/**
 * Loads and mutates a Team Hub discussion thread for one entity target.
 *
 * @param hubId - Team Hub connection id backing the entity.
 * @param target - Entity type and server UUID for discussion routes.
 * @returns Discussion panel state and mutation helpers.
 */
export function useDiscussionPanel(
  hubId: string | undefined,
  target: TeamHubDiscussionTarget | undefined
): DiscussionPanelState {
  const [comments, setComments] = useState<TeamHubDiscussionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reloads discussion comments from the Team Hub when the target changes.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!hubId || !target) {
      setComments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await window.api.listTeamHubDiscussions(hubId, target, { limit: 100 });
      setComments(response.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [hubId, target]);

  /**
   * Fetches the discussion thread whenever the hub target becomes available.
   */
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /**
   * Runs a mutation helper and refreshes the thread afterward.
   *
   * @param action - Team Hub mutation to execute.
   */
  const runMutation = useCallback(
    async (action: () => Promise<void>): Promise<void> => {
      if (!hubId || !target) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await action();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [hubId, target, refresh]
  );

  /**
   * Creates a root-level comment on the target entity.
   *
   * @param body - Comment text to post.
   */
  const postComment = useCallback(
    async (body: string): Promise<void> => {
      if (!hubId || !target) {
        return;
      }
      await runMutation(async () => {
        await window.api.createTeamHubDiscussion(hubId, target, { body });
      });
    },
    [hubId, target, runMutation]
  );

  /**
   * Creates a reply to an existing comment.
   *
   * @param parentCommentId - Parent comment UUID.
   * @param body - Reply text to post.
   */
  const postReply = useCallback(
    async (parentCommentId: string, body: string): Promise<void> => {
      if (!hubId || !target) {
        return;
      }
      await runMutation(async () => {
        await window.api.createTeamHubDiscussion(hubId, target, { body, parentCommentId });
      });
    },
    [hubId, target, runMutation]
  );

  /**
   * Updates an existing comment body.
   *
   * @param commentId - Comment UUID.
   * @param body - Replacement body text.
   */
  const updateComment = useCallback(
    async (commentId: string, body: string): Promise<void> => {
      if (!hubId || !target) {
        return;
      }
      await runMutation(async () => {
        await window.api.updateTeamHubDiscussionComment(hubId, target, commentId, { body });
      });
    },
    [hubId, target, runMutation]
  );

  /**
   * Tombstones a comment by id.
   *
   * @param commentId - Comment UUID.
   */
  const deleteComment = useCallback(
    async (commentId: string): Promise<void> => {
      if (!hubId) {
        return;
      }
      await runMutation(async () => {
        await window.api.deleteTeamHubDiscussionComment(hubId, commentId);
      });
    },
    [hubId, runMutation]
  );

  const tree = useMemo(() => buildDiscussionTree(comments), [comments]);

  return {
    tree,
    comments,
    loading,
    saving,
    error,
    refresh,
    postComment,
    postReply,
    updateComment,
    deleteComment
  };
}
