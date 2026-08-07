import { useMemo, type JSX } from 'react';
import type { TeamHubDiscussionEntityType } from '@harborclient/core/types';
import { DiscussionPanel } from './DiscussionPanel';
import { useDiscussionAvailability } from './useDiscussionAvailability';

interface Props {
  /**
   * Collection provider connection id for the entity's collection.
   */
  connectionId: string | undefined;

  /**
   * Entity kind hosting the discussion thread.
   */
  entityType: TeamHubDiscussionEntityType;

  /**
   * Server-side entity UUID.
   */
  entityUuid: string | undefined;

  /**
   * Accessible name for the discussion region.
   */
  ariaLabel?: string;

  /**
   * Content shown when threaded discussion is unavailable for this entity.
   */
  fallback?: JSX.Element;
}

/**
 * Entity-scoped Discuss panel for collections, folders, and run results.
 */
export function EntityDiscussPanel({
  connectionId,
  entityType,
  entityUuid,
  ariaLabel,
  fallback
}: Props): JSX.Element {
  /**
   * Keeps the target identity stable between equivalent renders so background
   * refreshes do not reset the discussion thread.
   */
  const target = useMemo(
    () => (entityUuid ? ({ entityType, entityId: entityUuid } as const) : undefined),
    [entityType, entityUuid]
  );
  const availability = useDiscussionAvailability(connectionId, target);

  if (availability.loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" role="status" aria-live="polite">
        <p className="m-0 text-muted">Loading discussion…</p>
      </div>
    );
  }

  if (availability.mode === 'threaded' && availability.hubId && availability.target) {
    return (
      <DiscussionPanel
        hubId={availability.hubId}
        target={availability.target}
        discussionE2ee={availability.discussionE2ee}
        deviceEnrolled={availability.deviceEnrolled}
        ariaLabel={ariaLabel}
      />
    );
  }

  return (
    fallback ?? (
      <p className="m-0 text-muted">
        Discussion is available on connected Team Hub collections with communication enabled.
      </p>
    )
  );
}
