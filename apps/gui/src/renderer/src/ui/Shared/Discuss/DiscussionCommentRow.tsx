import { useId, useState, type JSX } from 'react';
import { Button } from '@harborclient/sdk/components';
import { formatRelativeTime } from '@harborclient/sdk/ui';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { CommentEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/CommentEditor';
import { DiscussionCommentAvatar } from './DiscussionCommentAvatar';
import { DiscussionMarkdownBody } from './DiscussionMarkdownBody';
import { DiscussionThreadWatchControl } from './DiscussionThreadWatchControl';
import {
  DISCUSSION_MAX_RENDER_DEPTH,
  discussionCommentBodyText,
  type DiscussionTreeNode
} from './buildDiscussionTree';
import { DiscussionComposer } from './DiscussionComposer';

interface Props {
  /**
   * Team Hub connection id backing the discussion entity.
   */
  hubId: string;

  /**
   * Comment node to render, including nested replies.
   */
  node: DiscussionTreeNode;

  /**
   * Current nesting depth starting at 1 for root comments.
   */
  depth?: number;

  /**
   * Disables reply, edit, and delete actions while a mutation is in flight.
   */
  disabled?: boolean;

  /**
   * Creates a reply under the rendered comment.
   *
   * @param parentCommentId - Parent comment UUID.
   * @param body - Reply body text.
   */
  onReply: (parentCommentId: string, body: string) => Promise<void>;

  /**
   * Updates the rendered comment body.
   *
   * @param commentId - Comment UUID.
   * @param body - Replacement body text.
   */
  onUpdate: (commentId: string, body: string) => Promise<void>;

  /**
   * Tombstones the rendered comment.
   *
   * @param commentId - Comment UUID.
   */
  onDelete: (commentId: string) => Promise<void>;
}

/**
 * Renders one discussion comment with optional nested replies up to three levels deep.
 */
export function DiscussionCommentRow({
  hubId,
  node,
  depth = 1,
  disabled = false,
  onReply,
  onUpdate,
  onDelete
}: Props): JSX.Element {
  const confirm = useConfirm();
  const editFieldId = useId();
  const [replyOpen, setReplyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState(node.comment.body ?? '');
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { comment } = node;
  const bodyText = discussionCommentBodyText(comment);
  const timestamp = formatRelativeTime(Date.parse(comment.createdAt));
  const canReply = depth < DISCUSSION_MAX_RENDER_DEPTH && !comment.tombstoned;
  const editErrorId = `${editFieldId}-error`;

  /**
   * Saves inline edits for non-tombstoned comments authored by the current user flow.
   */
  const handleSaveEdit = async (): Promise<void> => {
    const trimmed = editBody.trim();
    if (!trimmed) {
      setEditError('Enter a comment before saving.');
      return;
    }

    setActionError(null);
    setEditError(null);
    try {
      await onUpdate(comment.id, trimmed);
      setEditOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Confirms and tombstones the current comment.
   */
  const handleDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Delete comment?',
      message: 'The comment will be marked deleted but replies will remain visible.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    setActionError(null);
    try {
      await onDelete(comment.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Opens the inline markdown editor seeded with the current comment body.
   */
  const handleStartEdit = (): void => {
    setEditBody(comment.body ?? '');
    setEditError(null);
    setEditOpen(true);
  };

  return (
    <article className="flex min-w-0 gap-3" aria-label={`Comment by ${comment.author.name}`}>
      <DiscussionCommentAvatar author={comment.author} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium">{comment.author.name}</span>
          <time className="text-[14px] text-muted" dateTime={comment.createdAt}>
            {timestamp}
          </time>
        </div>

        {editOpen && !comment.tombstoned ? (
          <div className="space-y-2">
            <span id={editFieldId} className="font-medium">
              Edit comment
            </span>
            <CommentEditor
              value={editBody}
              onChange={setEditBody}
              label="Edit comment"
              showHeader={false}
              variant="inline"
              disabled={disabled}
              ariaInvalid={editError != null}
              ariaDescribedBy={editError != null ? editErrorId : undefined}
            />
            {editError != null ? (
              <p id={editErrorId} className="m-0 text-danger" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={disabled} onClick={() => void handleSaveEdit()}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : comment.tombstoned ? (
          <p className="m-0 text-muted italic">{bodyText}</p>
        ) : (
          <DiscussionMarkdownBody content={bodyText} />
        )}

        {!comment.tombstoned ? (
          <div className="flex flex-wrap gap-2">
            {canReply ? (
              <Button
                type="button"
                variant="toolbar"
                disabled={disabled}
                onClick={() => setReplyOpen((open) => !open)}
              >
                Reply
              </Button>
            ) : null}
            <Button type="button" variant="toolbar" disabled={disabled} onClick={handleStartEdit}>
              Edit
            </Button>
            <Button
              type="button"
              variant="toolbar"
              disabled={disabled}
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
            {depth === 1 ? (
              <DiscussionThreadWatchControl hubId={hubId} rootCommentId={comment.rootCommentId} />
            ) : null}
          </div>
        ) : null}

        {replyOpen && canReply ? (
          <DiscussionComposer
            label={`Reply to ${comment.author.name}`}
            submitLabel="Reply"
            placeholder="Write a reply…"
            disabled={disabled}
            onSubmit={async (body) => {
              await onReply(comment.id, body);
              setReplyOpen(false);
            }}
          />
        ) : null}

        {actionError != null ? (
          <p className="m-0 text-danger" role="alert">
            {actionError}
          </p>
        ) : null}

        {node.replies.length > 0 ? (
          <div className="space-y-4 border-l border-separator pl-4">
            {node.replies.map((reply) => (
              <DiscussionCommentRow
                key={reply.comment.id}
                hubId={hubId}
                node={reply}
                depth={depth + 1}
                disabled={disabled}
                onReply={onReply}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
