import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { loadRequest, openPageTab, setActiveDraft } from '#/renderer/src/store/slices/tabsSlice';
import type { PageRef } from '#/renderer/src/store/tabs';
import { selectEffectiveActiveRequestTab } from '#/renderer/src/store/selectors';
import { SEND_REQUEST_PENDING_TYPE } from '#/renderer/src/store/thunks/sendRequestType';
import type { WorkflowRegistryEntry } from './workflowEventTypes';
import { event, isPageRef, isRequestDraft, isSavedRequest } from './utils';
import {
  mergeWorkflowDraftPayload,
  parseWorkflowDraftPayload,
  resolveSavedRequestForPlayback
} from './workflowPlaybackHelpers';

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
    eventType: 'request.load',
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
     * Reloads a saved request by uuid (preferred) or id into a tab.
     *
     * @param action - Recorded request.load action.
     * @param ctx - Playback Redux context.
     */
    play: async (action, ctx) => {
      const payload = (action.payload ?? {}) as {
        uuid?: string;
        id?: number;
        activate?: boolean;
      };
      const req = await resolveSavedRequestForPlayback(ctx.getState(), payload);
      if (req == null) {
        const label =
          typeof payload.uuid === 'string'
            ? payload.uuid
            : typeof payload.id === 'number'
              ? String(payload.id)
              : 'unknown';
        throw new Error(`Request not found for playback (${label}).`);
      }
      ctx.dispatch(loadRequest({ req, activate: payload.activate !== false }));
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
    eventType: 'request.draft',
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
     * Applies a recorded draft patch onto the active request tab.
     *
     * @param action - Recorded request.draft action.
     * @param ctx - Playback Redux context.
     */
    play: (action, ctx) => {
      const payload = parseWorkflowDraftPayload(action.payload);
      if (payload == null) {
        throw new Error('Invalid request.draft payload for playback.');
      }
      const tab = selectEffectiveActiveRequestTab(ctx.getState());
      if (tab == null) {
        throw new Error('No active request tab for request.draft playback.');
      }
      ctx.dispatch(setActiveDraft(mergeWorkflowDraftPayload(tab.draft, payload)));
    },
    /**
     * Collapses consecutive draft edits into one last-write-wins event.
     *
     * @returns Constant draft coalesce key.
     */
    coalesceKey: () => 'request.draft'
  },
  {
    eventType: 'request.send',
    match: SEND_REQUEST_PENDING_TYPE,
    /**
     * Records a send of the active request tab (tab ids are session-local).
     *
     * @returns request.send event targeting the active tab.
     */
    record: () => event('request.send', { target: 'active' }),
    /**
     * Sends the active request via the normal send thunk (not lifecycle pending).
     *
     * @param _action - Recorded request.send action.
     * @param ctx - Playback Redux context.
     */
    play: async (_action, ctx) => {
      // Dynamic import keeps the registry load path free of react-hot-toast (requests thunk).
      const { sendRequest } = await import('#/renderer/src/store/thunks/requests');
      await ctx.dispatch(sendRequest()).unwrap();
    }
  },
  {
    eventType: 'environment.activate',
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
     * Activates the recorded environment id (or clears when null).
     *
     * @param action - Recorded environment.activate action.
     * @param ctx - Playback Redux context.
     */
    play: (action, ctx) => {
      const payload = action.payload as { environmentId?: number | null } | undefined;
      const environmentId = payload?.environmentId ?? null;
      if (environmentId !== null && typeof environmentId !== 'number') {
        throw new Error('Invalid environment.activate payload for playback.');
      }
      ctx.dispatch(setActiveEnvironmentId(environmentId));
    },
    /**
     * Coalesces rapid environment toggles to the last selection.
     *
     * @returns Constant environment coalesce key.
     */
    coalesceKey: () => 'environment.activate'
  },
  {
    eventType: 'page.open',
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
     * Opens or focuses the recorded page tab.
     *
     * @param action - Recorded page.open action.
     * @param ctx - Playback Redux context.
     */
    play: (action, ctx) => {
      const page = (action.payload as { page?: PageRef } | undefined)?.page;
      if (!isPageRef(page)) {
        throw new Error('Invalid page.open payload for playback.');
      }
      ctx.dispatch(openPageTab(page));
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
