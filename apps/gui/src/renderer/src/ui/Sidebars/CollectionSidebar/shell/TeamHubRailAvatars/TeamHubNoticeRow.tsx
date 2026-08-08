import type { JSX } from 'react';
import type { TeamHubNotice } from '@harborclient/core/types';
import {
  formatTeamHubNoticeMessage,
  formatTeamHubNoticeTargetLabel
} from './formatTeamHubNoticeMessage';
import { TeamHubNoticeActorAvatar } from './TeamHubNoticeActorAvatar';

interface Props {
  /**
   * Notice row to render.
   */
  notice: TeamHubNotice;

  /**
   * Team hub connection id used to fetch uploaded actor avatars.
   */
  hubId: string;

  /**
   * Called when the user activates the notice row.
   */
  onSelect: () => void;
}

/**
 * Formats an ISO timestamp for compact notice list display.
 *
 * @param iso - ISO 8601 timestamp from the notice payload.
 */
function formatNoticeTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * One actionable notice row in the Team Hub rail dropdown.
 */
export function TeamHubNoticeRow({ notice, hubId, onSelect }: Props): JSX.Element {
  const unread = notice.readAt == null;
  const message = formatTeamHubNoticeMessage(notice);
  const targetLabel = formatTeamHubNoticeTargetLabel(notice);
  const label = `${notice.actor.name}: ${message}. ${targetLabel}. ${formatNoticeTimestamp(notice.createdAt)}`;

  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-start gap-3 border-none bg-transparent px-3 py-2 text-left hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
        unread ? 'bg-accent/5' : ''
      }`}
      aria-label={label}
      onClick={onSelect}
    >
      <TeamHubNoticeActorAvatar actor={notice.actor} hubId={hubId} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium text-text">{notice.actor.name}</span>
          <time className="text-muted" dateTime={notice.createdAt}>
            {formatNoticeTimestamp(notice.createdAt)}
          </time>
          {unread ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[14px] text-white">New</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-text">{message}</span>
        <span className="mt-0.5 block text-muted">{targetLabel}</span>
      </span>
    </button>
  );
}
