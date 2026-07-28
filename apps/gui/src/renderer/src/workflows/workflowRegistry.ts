import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { loadRequest, openPageTab, setActiveDraft } from '#/renderer/src/store/slices/tabsSlice';
import type { PageRef } from '#/renderer/src/store/tabs';
import { SEND_REQUEST_PENDING_TYPE } from '#/renderer/src/store/thunks/sendRequestType';
import type { WorkflowRegistryEntry } from './workflowEventTypes';
import { event, isPageRef, isRequestDraft, isSavedRequest } from './utils';

/**
 * Allowlisted Redux actions that become workflow events.
 *
 * Fan-out side effects (history, reconcile, response updates) are omitted by
 * simply not registering them — only intent actions are listed here.
 * Slice `match` values use action-creator `.type`; async thunk lifecycle types
 * use shared constants from the thunk modules so the registry stays coupled
 * without importing heavy thunk graphs.
 */
export const WORKFLOW_REGISTRY: readonly WorkflowRegistryEntry[] = [
  {
    match: loadRequest.type,
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
    match: setActiveDraft.type,
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
    match: SEND_REQUEST_PENDING_TYPE,
    /**
     * Records a send of the active request tab (tab ids are session-local).
     *
     * @returns request.send event targeting the active tab.
     */
    record: () => event('request.send', { target: 'active' })
  },
  {
    match: setActiveEnvironmentId.type,
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
    match: openPageTab.type,
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
