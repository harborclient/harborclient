import { useMemo, type JSX } from 'react';
import type { Variable } from '@harborclient/core/types';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectCollections, selectRequestsByCollection } from '#/renderer/src/store/selectors';
import type { RequestDraft } from '#/renderer/src/store/tabs';
import { DiscussionPanel } from './DiscussionPanel';
import { LegacyNotesPanel } from './LegacyNotesPanel';
import { useDiscussionAvailability } from './useDiscussionAvailability';

interface Props {
  /**
   * Current request draft being edited.
   */
  draft: RequestDraft;

  /**
   * Merges a partial update into the current draft.
   */
  update: (patch: Partial<RequestDraft>) => void;

  /**
   * Collection-scoped variables for legacy notes highlighting.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;
}

/**
 * Request Discuss tab content that switches between legacy notes and threaded discussion.
 */
export function RequestDiscussPanel({
  draft,
  update,
  variables,
  onEditVariables
}: Props): JSX.Element {
  const collections = useAppSelector(selectCollections);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);

  const collection = draft.collection_id
    ? collections.find((entry) => entry.id === draft.collection_id)
    : undefined;

  const savedRequest = useMemo(() => {
    if (draft.id == null || draft.collection_id == null) {
      return undefined;
    }
    return (requestsByCollection[draft.collection_id] ?? []).find((entry) => entry.id === draft.id);
  }, [draft.collection_id, draft.id, requestsByCollection]);

  const target = savedRequest
    ? ({ entityType: 'request', entityId: savedRequest.uuid } as const)
    : undefined;

  const availability = useDiscussionAvailability(collection?.connectionId, target);

  const markdownReference = useMemo(() => {
    if (savedRequest == null) {
      return undefined;
    }
    return {
      uuid: savedRequest.uuid,
      label: `Comment: ${draft.name}`
    };
  }, [draft.name, savedRequest]);

  if (availability.loading) {
    return (
      <p className="m-0 text-muted" role="status" aria-live="polite">
        Loading discussion…
      </p>
    );
  }

  if (availability.mode === 'threaded' && availability.hubId && availability.target) {
    return (
      <DiscussionPanel
        hubId={availability.hubId}
        target={availability.target}
        discussionE2ee={availability.discussionE2ee}
        deviceEnrolled={availability.deviceEnrolled}
      />
    );
  }

  return (
    <LegacyNotesPanel
      draft={draft}
      update={update}
      variables={variables}
      onEditVariables={onEditVariables}
      markdownReference={markdownReference}
    />
  );
}
