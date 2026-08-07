import { Button } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { TeamHubDiscussionTarget } from '@harborclient/core/types';
import { DiscussionComposer } from '../DiscussionComposer';
import { DiscussionThreadList } from '../DiscussionThreadList';
import { useDiscussionPanel } from '../useDiscussionPanel';
import { useTeamHubDeviceEnrollment } from '#/renderer/src/hooks/useTeamHubDeviceEnrollment';

interface Props {
  /**
   * Team Hub connection id backing the target entity.
   */
  hubId: string;

  /**
   * Target descriptor passed to Team Hub discussion IPC methods.
   */
  target: TeamHubDiscussionTarget;

  /**
   * When true, the hub requires encrypted discussion bodies.
   */
  discussionE2ee?: boolean;

  /**
   * When true, this device has active local keys and a matching server enrollment.
   */
  deviceEnrolled?: boolean;

  /**
   * Accessible name for the discussion region.
   */
  ariaLabel?: string;
}

/**
 * Threaded Team Hub discussion panel with composer, replies, and inline errors.
 */
export function DiscussionPanel({
  hubId,
  target,
  discussionE2ee = false,
  deviceEnrolled = false,
  ariaLabel = 'Discussion thread'
}: Props): JSX.Element {
  const panel = useDiscussionPanel(hubId, target);
  const enrollment = useTeamHubDeviceEnrollment();
  const composerDisabled = panel.saving || (discussionE2ee && !deviceEnrolled);
  const needsEnrollment = discussionE2ee && !deviceEnrolled;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-4"
      aria-label={ariaLabel}
      aria-busy={panel.loading || panel.saving || enrollment.enrolling}
    >
      {discussionE2ee ? (
        <div
          className="m-0 rounded-md border border-border bg-surface px-4 py-3 text-muted"
          role="status"
        >
          {needsEnrollment ? (
            <>
              <p className="m-0">
                Discussion bodies on this Team Hub are end-to-end encrypted. Enroll this device
                before encrypted comments can be sent.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={enrollment.enrolling}
                  onClick={() => void enrollment.enroll(hubId)}
                >
                  {enrollment.enrolling ? 'Enrolling…' : 'Enroll this device'}
                </Button>
                {enrollment.error ? (
                  <p className="m-0 text-danger" role="alert">
                    {enrollment.error}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="m-0">
              Discussion bodies on this Team Hub are end-to-end encrypted. Comments you send from
              this device are encrypted before upload.
            </p>
          )}
        </div>
      ) : null}
      {panel.loading ? (
        <p className="m-0 text-muted" role="status" aria-live="polite">
          Loading discussion…
        </p>
      ) : null}

      {!panel.loading ? (
        <DiscussionThreadList
          hubId={hubId}
          tree={panel.tree}
          disabled={composerDisabled}
          onReply={panel.postReply}
          onUpdate={panel.updateComment}
          onDelete={panel.deleteComment}
        />
      ) : null}

      <DiscussionComposer
        label="Add a comment"
        disabled={composerDisabled}
        onSubmit={panel.postComment}
      />

      {panel.error != null ? (
        <p className="m-0 text-danger" role="alert">
          {panel.error}
        </p>
      ) : null}
    </section>
  );
}
