import type { SavedRequest } from '@harborclient/core/types';
import type { PageRef, RequestDraft } from '#/renderer/src/store/tabs';
import type { WorkflowEvent, WorkflowRegistryEntry } from './workflowEventTypes';

/**
 * Builds a workflow event with a fresh timestamp.
 *
 * @param type - Logical event type.
 * @param payload - Normalized payload.
 * @returns Timestamped workflow event.
 */
function event(type: string, payload: unknown): WorkflowEvent {
  return { type, at: Date.now(), payload };
}

/**
 * Returns whether a value looks like a saved request payload for loadRequest.
 *
 * @param value - Unknown payload candidate.
 * @returns True when the value has the fields needed for request.load.
 */
function isSavedRequest(value: unknown): value is SavedRequest {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  const req = value as Partial<SavedRequest>;
  return typeof req.id === 'number' && typeof req.uuid === 'string' && typeof req.name === 'string';
}

/**
 * Returns whether a value looks like a request draft for setActiveDraft.
 *
 * @param value - Unknown payload candidate.
 * @returns True when the value has core draft fields.
 */
function isRequestDraft(value: unknown): value is RequestDraft {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  const draft = value as Partial<RequestDraft>;
  return (
    typeof draft.name === 'string' &&
    typeof draft.method === 'string' &&
    typeof draft.url === 'string' &&
    Array.isArray(draft.headers)
  );
}

/**
 * Returns whether a value looks like a page reference for openPageTab.
 *
 * @param value - Unknown payload candidate.
 * @returns True when the value has a page type string.
 */
function isPageRef(value: unknown): value is PageRef {
  return typeof value === 'object' && value != null && typeof (value as PageRef).type === 'string';
}

/**
 * Allowlisted Redux actions that become workflow events.
 *
 * Fan-out side effects (history, reconcile, response updates) are omitted by
 * simply not registering them — only intent actions are listed here.
 */
export const WORKFLOW_REGISTRY: readonly WorkflowRegistryEntry[] = [
  {
    match: 'tabs/loadRequest',
    /**
     * Records opening a saved request using stable request identity.
     *
     * @param action - Redux loadRequest action.
     * @returns request.load event, or null when the payload is invalid.
     */
    record: (action) => {
      const payload = action.payload as { req?: unknown; activate?: boolean } | undefined;
      if (!isSavedRequest(payload?.req)) {
        return null;
      }
      const req = payload.req;
      return event('request.load', {
        id: req.id,
        uuid: req.uuid,
        name: req.name,
        collectionId: req.collection_id,
        method: req.method,
        url: req.url,
        activate: payload.activate !== false
      });
    },
    /**
     * Coalesces repeated loads of the same request (e.g. re-clicks).
     *
     * @param workflowEvent - Candidate request.load event.
     * @returns Key scoped to the request id.
     */
    coalesceKey: (workflowEvent) => {
      const id = (workflowEvent.payload as { id?: number }).id;
      return `request.load:${id ?? 'unknown'}`;
    }
  },
  {
    match: 'tabs/setActiveDraft',
    /**
     * Records the latest full draft after editor changes (coalesced).
     *
     * @param action - Redux setActiveDraft action.
     * @returns request.draft event, or null when the payload is invalid.
     */
    record: (action) => {
      if (!isRequestDraft(action.payload)) {
        return null;
      }
      const draft = action.payload;
      return event('request.draft', {
        id: draft.id ?? null,
        collectionId: draft.collection_id ?? null,
        folderId: draft.folder_id ?? null,
        name: draft.name,
        method: draft.method,
        url: draft.url,
        headers: draft.headers,
        params: draft.params,
        auth: draft.auth,
        bodyType: draft.body_type,
        body: draft.body,
        comment: draft.comment
      });
    },
    /**
     * Collapses consecutive draft edits into one last-write-wins event.
     *
     * @returns Constant draft coalesce key.
     */
    coalesceKey: () => 'request.draft'
  },
  {
    match: 'tabs/sendRequest/pending',
    /**
     * Records a send of the active request tab (tab ids are session-local).
     *
     * @returns request.send event targeting the active tab.
     */
    record: () => event('request.send', { target: 'active' })
  },
  {
    match: 'environments/setActiveEnvironmentId',
    /**
     * Records switching the active environment.
     *
     * @param action - Redux setActiveEnvironmentId action.
     * @returns environment.activate event.
     */
    record: (action) => {
      const environmentId = action.payload;
      if (environmentId !== null && typeof environmentId !== 'number') {
        return null;
      }
      return event('environment.activate', { environmentId });
    },
    /**
     * Coalesces rapid environment toggles to the last selection.
     *
     * @returns Constant environment coalesce key.
     */
    coalesceKey: () => 'environment.activate'
  },
  {
    match: 'tabs/openPageTab',
    /**
     * Records opening a configuration / page tab.
     *
     * @param action - Redux openPageTab action.
     * @returns page.open event, or null when the payload is invalid.
     */
    record: (action) => {
      if (!isPageRef(action.payload)) {
        return null;
      }
      return event('page.open', { page: action.payload });
    },
    /**
     * Coalesces reopen/focus of the same page type into one event.
     *
     * @param workflowEvent - Candidate page.open event.
     * @returns Key scoped to the page type (and id when present).
     */
    coalesceKey: (workflowEvent) => {
      const page = (workflowEvent.payload as { page: PageRef }).page;
      if ('id' in page && typeof page.id === 'number') {
        return `page.open:${page.type}:${page.id}`;
      }
      if ('collectionId' in page && typeof page.collectionId === 'number') {
        return `page.open:${page.type}:${page.collectionId}`;
      }
      return `page.open:${page.type}`;
    }
  }
];

/**
 * Builds a lookup map from Redux action type to registry entry.
 *
 * @param entries - Registry entries to index.
 * @returns Map of action type → entry.
 */
export function buildWorkflowRegistryMap(
  entries: readonly WorkflowRegistryEntry[] = WORKFLOW_REGISTRY
): Map<string, WorkflowRegistryEntry> {
  const map = new Map<string, WorkflowRegistryEntry>();
  for (const entry of entries) {
    const matches = typeof entry.match === 'string' ? [entry.match] : entry.match;
    for (const type of matches) {
      map.set(type, entry);
    }
  }
  return map;
}
