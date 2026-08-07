import type { TeamHubNotice } from '@harborclient/core/types';

/**
 * Builds the primary action line shown in Team Hub notice rows.
 *
 * Copy is derived from the notice event kind and denormalized display metadata
 * returned by Team Hub notice routes.
 *
 * @param notice - Notice row from the Team Hub API.
 * @returns Human-readable action summary for list rendering.
 */
export function formatTeamHubNoticeMessage(notice: TeamHubNotice): string {
  const { actorName, targetLabel, previewText, runLabel } = notice.displayMetadata;

  switch (notice.eventType) {
    case 'request.updated':
      return `${actorName} updated ${targetLabel}`;
    case 'discussion.comment':
      return previewText
        ? `${actorName} commented on ${targetLabel}: ${previewText}`
        : `${actorName} commented on ${targetLabel}`;
    case 'discussion.reply':
      return previewText
        ? `${actorName} replied on ${targetLabel}: ${previewText}`
        : `${actorName} replied on ${targetLabel}`;
    case 'discussion.mention':
      return previewText
        ? `${actorName} mentioned you on ${targetLabel}: ${previewText}`
        : `${actorName} mentioned you on ${targetLabel}`;
    case 'runResult.created':
      return `${actorName} saved run ${runLabel ?? targetLabel}`;
    case 'runResult.failed':
      return `${actorName} reported a failed run ${runLabel ?? targetLabel}`;
  }
}

/**
 * Returns the secondary target label shown beneath the notice action line.
 *
 * @param notice - Notice row from the Team Hub API.
 * @returns Human-readable target label for list rendering.
 */
export function formatTeamHubNoticeTargetLabel(notice: TeamHubNotice): string {
  return notice.displayMetadata.targetLabel;
}
