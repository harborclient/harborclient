import type { SavedRequest } from '@harborclient/core/types';
import type { WorkflowEvent, WorkflowPlayCtx, WorkflowRecordCtx } from './workflowEventTypes';
import { event, isPageRef, isRequestDraft, isSavedRequest } from './utils';
import {
  findTabByIdentity,
  parseWorkflowTabIdentity,
  resolveEnvironmentIdByUuid,
  resolveEnvironmentUuid,
  resolveTabIdentity,
  resolveWorkspaceIdForPlayback
} from './workflowIdentity';
import {
  mergeWorkflowDraftPayload,
  parseWorkflowDraftPayload,
  resolveSavedRequestForPlayback
} from './workflowPlaybackHelpers';
import { takePendingTabCloseIdentity } from './workflowTabCloseBridge';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  closeAllRequestAndMarkdownTabs,
  closeTab,
  loadRequest,
  newTab,
  openPageTab,
  setActiveDraft,
  setActiveTab
} from '#/renderer/src/store/slices/tabsSlice';
import type { PageRef } from '#/renderer/src/store/tabs';
import { isRequestTab } from '#/renderer/src/store/tabs';
import { selectEffectiveActiveRequestTab } from '#/renderer/src/store/selectors';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import { CANCEL_REQUEST_PENDING_TYPE } from '#/renderer/src/store/thunks/cancelRequestType';
import {
  NEW_REQUEST_IN_COLLECTION_FULFILLED_TYPE,
  NEW_REQUEST_IN_FOLDER_FULFILLED_TYPE
} from '#/renderer/src/store/thunks/createRequestType';
import { OPEN_WORKSPACE_PENDING_TYPE } from '#/renderer/src/store/thunks/openWorkspaceType';
import { SAVE_REQUEST_FULFILLED_TYPE } from '#/renderer/src/store/thunks/saveRequestType';
import { SEND_REQUEST_PENDING_TYPE } from '#/renderer/src/store/thunks/sendRequestType';

/**
 * Registry entry without UI thumbnails — safe to import from Node/playback tests.
 */
export interface WorkflowRegistryCoreEntry {
  /**
   * Stable logical event type written to the session / export.
   */
  eventType: string;

  /**
   * Redux action type string(s) this entry handles.
   */
  match: string | readonly string[];

  /**
   * Normalizes a matching action into a recordable event, or returns null to skip.
   *
   * @param action - Dispatched Redux action.
   * @param ctx - Coalesce / history context for the handler.
   * @returns Event to consider for recording, or null to ignore the action.
   */
  record: (
    action: { type: string; payload?: unknown; meta?: unknown },
    ctx: WorkflowRecordCtx
  ) => WorkflowEvent | null;

  /**
   * Replays a recorded event by dispatching the corresponding Redux intent.
   *
   * @param action - Recorded workflow action (`type` + `payload`).
   * @param ctx - Dispatch / getState for resolving and applying the step.
   * @returns Optional result harvested by the run log (e.g. request send outcome).
   */
  play: (
    action: { type: string; at?: number; payload: unknown },
    ctx: WorkflowPlayCtx
  ) => void | unknown | Promise<void | unknown>;

  /**
   * Builds the coalesce key for a candidate event.
   *
   * @param event - Candidate event from {@link record}.
   * @returns Coalesce key; defaults to `event.type` when omitted.
   */
  coalesceKey?: (event: WorkflowEvent) => string;
}

/**
 * Allowlisted Redux actions that become workflow events (record / play only).
 *
 * Thumbnails are attached in {@link WORKFLOW_REGISTRY} so Node-side playback
 * tests do not pull React UI modules.
 */
export const WORKFLOW_REGISTRY_CORE: readonly WorkflowRegistryCoreEntry[] = [
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
     * Coalesces repeated loads of the same request (prefer uuid).
     *
     * @param workflowEvent - Candidate request.load event.
     * @returns Key scoped to the request uuid or id.
     */
    coalesceKey: (workflowEvent) => {
      const payload = workflowEvent.payload as { uuid?: string; id?: number };
      return `request.load:${payload.uuid ?? payload.id ?? 'unknown'}`;
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
     * Captures method/name/url from the active draft for timeline display; playback
     * still targets the active tab and ignores display fields.
     *
     * @param _action - Redux send pending action.
     * @param ctx - Record context with getState for the active tab.
     * @returns request.send event targeting the active tab.
     */
    record: (_action, ctx) => {
      const tab = selectEffectiveActiveRequestTab(ctx.getState());
      const draft = tab?.draft;
      if (draft == null) {
        return event('request.send', { target: 'active' });
      }
      return event('request.send', {
        target: 'active',
        method: draft.method,
        name: draft.name,
        url: draft.url
      });
    },
    /**
     * Sends the active request via the normal send thunk (not lifecycle pending).
     *
     * @param _action - Recorded request.send action.
     * @param ctx - Playback Redux context.
     * @returns Completed send outcome for the workflow run log, or null when skipped.
     */
    play: async (_action, ctx) => {
      const { sendRequest } = await import('#/renderer/src/store/thunks/requests');
      return await ctx.dispatch(sendRequest()).unwrap();
    }
  },
  {
    eventType: 'request.save',
    match: SAVE_REQUEST_FULFILLED_TYPE,
    /**
     * Records a successful save using the fulfilled SavedRequest payload.
     *
     * @param action - Redux saveRequest fulfilled action.
     * @returns request.save event, or null when the payload is invalid.
     */
    record: (action) => {
      if (!isSavedRequest(action.payload)) {
        return null;
      }
      const req = action.payload;
      return event('request.save', {
        uuid: req.uuid,
        id: req.id,
        collectionId: req.collection_id,
        folderId: req.folder_id ?? null,
        name: req.name,
        method: req.method,
        url: req.url
      });
    },
    /**
     * Saves the active request tab draft.
     *
     * @param _action - Recorded request.save action.
     * @param ctx - Playback Redux context.
     */
    play: async (_action, ctx) => {
      const { saveRequest } = await import('#/renderer/src/store/thunks/requests');
      await ctx.dispatch(saveRequest()).unwrap();
    },
    /**
     * Coalesces rapid saves of the same request.
     *
     * @param workflowEvent - Candidate request.save event.
     * @returns Key scoped to request uuid.
     */
    coalesceKey: (workflowEvent) => {
      const uuid = (workflowEvent.payload as { uuid?: string }).uuid;
      return `request.save:${uuid ?? 'unknown'}`;
    }
  },
  {
    eventType: 'request.create',
    match: [NEW_REQUEST_IN_COLLECTION_FULFILLED_TYPE, NEW_REQUEST_IN_FOLDER_FULFILLED_TYPE],
    /**
     * Records creating a saved request in a collection or folder.
     *
     * @param action - Redux create fulfilled action.
     * @returns request.create event, or null when the payload is invalid.
     */
    record: (action) => {
      if (!isSavedRequest(action.payload)) {
        return null;
      }
      const req = action.payload as SavedRequest;
      return event('request.create', {
        uuid: req.uuid,
        id: req.id,
        collectionId: req.collection_id,
        folderId: req.folder_id ?? null,
        name: req.name
      });
    },
    /**
     * Creates a new request in the recorded collection/folder placement.
     *
     * @param action - Recorded request.create action.
     * @param ctx - Playback Redux context.
     */
    play: async (action, ctx) => {
      const payload = (action.payload ?? {}) as {
        collectionId?: number;
        folderId?: number | null;
      };
      if (typeof payload.collectionId !== 'number') {
        throw new Error('Invalid request.create payload for playback.');
      }
      const { newRequestInCollection, newRequestInFolder } =
        await import('#/renderer/src/store/thunks/requests');
      if (typeof payload.folderId === 'number') {
        await ctx
          .dispatch(
            newRequestInFolder({ collectionId: payload.collectionId, folderId: payload.folderId })
          )
          .unwrap();
        return;
      }
      await ctx.dispatch(newRequestInCollection(payload.collectionId)).unwrap();
    }
  },
  {
    eventType: 'request.cancel',
    match: CANCEL_REQUEST_PENDING_TYPE,
    /**
     * Records cancelling the in-flight send on the active tab.
     *
     * @returns request.cancel event targeting the active tab.
     */
    record: () => event('request.cancel', { target: 'active' }),
    /**
     * Cancels the in-flight send on the active request tab.
     *
     * @param _action - Recorded request.cancel action.
     * @param ctx - Playback Redux context.
     */
    play: async (_action, ctx) => {
      const tab = selectEffectiveActiveRequestTab(ctx.getState());
      if (tab == null) {
        throw new Error('No active request tab for request.cancel playback.');
      }
      const { cancelRequest } = await import('#/renderer/src/store/thunks/requests');
      await ctx.dispatch(cancelRequest(tab.tabId)).unwrap();
    }
  },
  {
    eventType: 'environment.activate',
    match: setActiveEnvironmentId.type,
    /**
     * Records switching the active environment with portable uuid when available.
     *
     * @param action - Redux setActiveEnvironmentId action.
     * @param ctx - Record context with getState for uuid lookup.
     * @returns environment.activate event.
     */
    record: (action, ctx) => {
      const environmentId = action.payload;
      if (environmentId !== null && typeof environmentId !== 'number') {
        return null;
      }

      return event('environment.activate', {
        environmentId,
        uuid: resolveEnvironmentUuid(ctx.getState(), environmentId)
      });
    },
    /**
     * Activates the recorded environment (uuid preferred) or clears when null.
     *
     * @param action - Recorded environment.activate action.
     * @param ctx - Playback Redux context.
     */
    play: (action, ctx) => {
      const payload = action.payload as
        | { environmentId?: number | null; uuid?: string | null }
        | undefined;
      if (payload?.uuid != null && typeof payload.uuid === 'string') {
        const id = resolveEnvironmentIdByUuid(ctx.getState(), payload.uuid);
        if (id == null) {
          throw new Error(`Environment not found for playback (${payload.uuid}).`);
        }
        ctx.dispatch(setActiveEnvironmentId(id));
        return;
      }
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
  },
  {
    eventType: 'workspace.open',
    match: OPEN_WORKSPACE_PENDING_TYPE,
    /**
     * Records opening a workspace as one atomic intent (fan-out is suppressed).
     *
     * @param action - Redux openWorkspace pending action.
     * @param ctx - Record context for workspace lookup.
     * @returns workspace.open event, or null when the workspace is missing.
     */
    record: (action, ctx) => {
      const meta = action.meta as { arg?: unknown } | undefined;
      const workspaceId = meta?.arg;
      if (typeof workspaceId !== 'number') {
        return null;
      }
      const workspace = selectWorkspaces(ctx.getState()).find((entry) => entry.id === workspaceId);
      if (workspace == null) {
        return null;
      }
      return event('workspace.open', {
        id: workspace.id,
        name: workspace.name,
        requestUuids: workspace.requests.map((member) => member.requestUuid)
      });
    },
    /**
     * Opens a workspace by id (preferred) or exact name.
     *
     * @param action - Recorded workspace.open action.
     * @param ctx - Playback Redux context.
     */
    play: async (action, ctx) => {
      const payload = (action.payload ?? {}) as { id?: number; name?: string };
      const workspaceId = resolveWorkspaceIdForPlayback(ctx.getState(), payload);
      if (workspaceId == null) {
        throw new Error(
          `Workspace not found for playback (${payload.name ?? payload.id ?? 'unknown'}).`
        );
      }
      const { openWorkspace } = await import('#/renderer/src/store/thunks/workspaces');
      await ctx.dispatch(openWorkspace(workspaceId)).unwrap();
    },
    /**
     * Coalesces reopen of the same workspace.
     *
     * @param workflowEvent - Candidate workspace.open event.
     * @returns Key scoped to workspace id or name.
     */
    coalesceKey: (workflowEvent) => {
      const payload = workflowEvent.payload as { id?: number; name?: string };
      return `workspace.open:${payload.id ?? payload.name ?? 'unknown'}`;
    }
  },
  {
    eventType: 'tab.activate',
    match: setActiveTab.type,
    /**
     * Records activating a tab using a portable identity (not session tabId).
     *
     * @param action - Redux setActiveTab action.
     * @param ctx - Record context for identity resolution.
     * @returns tab.activate event, or null when identity cannot be resolved.
     */
    record: (action, ctx) => {
      if (typeof action.payload !== 'string') {
        return null;
      }
      const identity = resolveTabIdentity(ctx.getState(), action.payload);
      if (identity == null) {
        return null;
      }
      return event('tab.activate', { identity });
    },
    /**
     * Activates the open tab matching the recorded identity.
     *
     * @param action - Recorded tab.activate action.
     * @param ctx - Playback Redux context.
     */
    play: (action, ctx) => {
      const identity = parseWorkflowTabIdentity(
        (action.payload as { identity?: unknown } | undefined)?.identity
      );
      if (identity == null) {
        throw new Error('Invalid tab.activate payload for playback.');
      }
      const tabId = findTabByIdentity(ctx.getState(), identity);
      if (tabId == null) {
        throw new Error('Tab not found for tab.activate playback.');
      }
      ctx.dispatch(setActiveTab(tabId));
    },
    /**
     * Coalesces rapid activation of the same logical tab.
     *
     * @param workflowEvent - Candidate tab.activate event.
     * @returns Key derived from identity.
     */
    coalesceKey: (workflowEvent) => {
      const identity = (workflowEvent.payload as { identity?: WorkflowTabIdentityLike }).identity;
      return `tab.activate:${tabIdentityKey(identity)}`;
    }
  },
  {
    eventType: 'tab.new',
    match: newTab.type,
    /**
     * Records opening a blank request tab.
     *
     * @returns tab.new event.
     */
    record: () => event('tab.new', {}),
    /**
     * Opens a blank request tab.
     *
     * @param _action - Recorded tab.new action.
     * @param ctx - Playback Redux context.
     */
    play: (_action, ctx) => {
      ctx.dispatch(newTab());
    }
  },
  {
    eventType: 'tab.close',
    match: closeTab.type,
    /**
     * Records closing a tab using identity captured before the tab was removed.
     *
     * @returns tab.close event, or null when identity was unavailable.
     */
    record: () => {
      const identity = takePendingTabCloseIdentity();
      if (identity == null) {
        return null;
      }
      return event('tab.close', { identity });
    },
    /**
     * Closes the open tab matching the recorded identity.
     *
     * @param action - Recorded tab.close action.
     * @param ctx - Playback Redux context.
     */
    play: async (action, ctx) => {
      const identity = parseWorkflowTabIdentity(
        (action.payload as { identity?: unknown } | undefined)?.identity
      );
      if (identity == null) {
        throw new Error('Invalid tab.close payload for playback.');
      }
      const tabId = findTabByIdentity(ctx.getState(), identity);
      if (tabId == null) {
        throw new Error('Tab not found for tab.close playback.');
      }
      const tab = ctx.getState().tabs.tabs.find((entry) => entry.tabId === tabId);
      if (tab != null && isRequestTab(tab)) {
        const { closeRequestTab } = await import('#/renderer/src/store/thunks/requests');
        await ctx.dispatch(closeRequestTab(tabId)).unwrap();
        return;
      }
      ctx.dispatch(closeTab(tabId));
    }
  },
  {
    eventType: 'tab.closeAll',
    match: closeAllRequestAndMarkdownTabs.type,
    /**
     * Records closing all request and markdown tabs.
     *
     * @returns tab.closeAll event.
     */
    record: () => event('tab.closeAll', {}),
    /**
     * Closes all request and markdown tabs.
     *
     * @param _action - Recorded tab.closeAll action.
     * @param ctx - Playback Redux context.
     */
    play: (_action, ctx) => {
      ctx.dispatch(closeAllRequestAndMarkdownTabs());
    }
  }
];

/**
 * Loose identity shape used only for coalesce key formatting.
 */
interface WorkflowTabIdentityLike {
  kind?: string;
  requestUuid?: string;
  documentId?: number;
  documentUuid?: string;
  page?: PageRef;
}

/**
 * Builds a stable coalesce suffix for a tab identity.
 *
 * @param identity - Recorded identity fragment.
 * @returns Coalesce key fragment.
 */
function tabIdentityKey(identity: WorkflowTabIdentityLike | undefined): string {
  if (identity == null || identity.kind == null) {
    return 'unknown';
  }
  if (identity.kind === 'request') {
    return `request:${identity.requestUuid ?? 'unknown'}`;
  }
  if (identity.kind === 'markdown') {
    return `markdown:${identity.documentUuid ?? identity.documentId ?? 'unknown'}`;
  }
  if (identity.kind === 'page' && identity.page != null) {
    return `page:${identity.page.type}`;
  }
  return identity.kind;
}
