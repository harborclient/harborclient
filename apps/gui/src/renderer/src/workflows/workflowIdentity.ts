import type { PageRef } from '#/renderer/src/store/tabs';
import { isMarkdownTab, isPageTab, isRequestTab, type Tab } from '#/renderer/src/store/tabs';
import type { RootState } from '#/renderer/src/store/redux';
import { selectDocumentsByCollection, selectEnvironments } from '#/renderer/src/store/selectors';
import { selectWorkspaces } from '#/renderer/src/store/slices/workspaceSlice';
import { routePageRefKey } from '#/renderer/src/store/routing';
import { findSavedRequestById, findSavedRequestByUuid } from './workflowPlaybackHelpers';

/**
 * Portable identity for a tab, used instead of session-local tab ids.
 */
export type WorkflowTabIdentity =
  | { kind: 'request'; requestUuid: string; requestId?: number }
  | { kind: 'page'; page: PageRef }
  | { kind: 'markdown'; documentId: number; documentUuid?: string }
  | { kind: 'blank' };

/**
 * Resolves an environment uuid from a numeric id in the current store.
 *
 * @param state - Root Redux state.
 * @param environmentId - Environment database id, or null when clearing.
 * @returns Environment uuid, or null when clearing / not found.
 */
export function resolveEnvironmentUuid(
  state: RootState,
  environmentId: number | null
): string | null {
  if (environmentId == null) {
    return null;
  }
  return (
    selectEnvironments(state).find((environment) => environment.id === environmentId)?.uuid ?? null
  );
}

/**
 * Resolves an environment numeric id from a portable uuid.
 *
 * @param state - Root Redux state.
 * @param uuid - Environment uuid.
 * @returns Matching environment id, or undefined when missing.
 */
export function resolveEnvironmentIdByUuid(state: RootState, uuid: string): number | undefined {
  return selectEnvironments(state).find((environment) => environment.uuid === uuid)?.id;
}

/**
 * Looks up a document uuid from the collections document cache.
 *
 * @param state - Root Redux state.
 * @param documentId - Document database id.
 * @returns Document uuid when cached.
 */
function findDocumentUuid(state: RootState, documentId: number): string | undefined {
  for (const documents of Object.values(selectDocumentsByCollection(state))) {
    const match = documents.find((document) => document.id === documentId);
    if (match != null) {
      return match.uuid;
    }
  }
  return undefined;
}

/**
 * Builds a portable tab identity from a live tab and store caches.
 *
 * @param state - Root Redux state.
 * @param tab - Open tab to describe.
 * @returns Portable identity, or null when the tab cannot be described.
 */
export function resolveTabIdentityFromTab(state: RootState, tab: Tab): WorkflowTabIdentity | null {
  if (isPageTab(tab)) {
    return { kind: 'page', page: tab.page };
  }

  if (isMarkdownTab(tab)) {
    return {
      kind: 'markdown',
      documentId: tab.docId,
      documentUuid: findDocumentUuid(state, tab.docId)
    };
  }

  if (!isRequestTab(tab)) {
    return null;
  }

  const requestId = tab.draft.id;
  if (typeof requestId !== 'number') {
    return { kind: 'blank' };
  }

  const saved = findSavedRequestById(state, requestId);
  if (saved?.uuid) {
    return { kind: 'request', requestUuid: saved.uuid, requestId };
  }

  return { kind: 'blank' };
}

/**
 * Resolves a portable identity for an open tab id.
 *
 * @param state - Root Redux state.
 * @param tabId - Session-local tab id.
 * @returns Portable identity, or null when the tab is missing.
 */
export function resolveTabIdentity(state: RootState, tabId: string): WorkflowTabIdentity | null {
  const tab = state.tabs.tabs.find((entry) => entry.tabId === tabId);
  if (tab == null) {
    return null;
  }
  return resolveTabIdentityFromTab(state, tab);
}

/**
 * Finds an open tab id that matches a recorded portable identity.
 *
 * @param state - Root Redux state.
 * @param identity - Recorded tab identity.
 * @returns Matching tab id, or undefined when not open.
 */
export function findTabByIdentity(
  state: RootState,
  identity: WorkflowTabIdentity
): string | undefined {
  const tabs = state.tabs.tabs;

  if (identity.kind === 'blank') {
    return tabs.find((tab) => isRequestTab(tab) && tab.draft.id == null)?.tabId;
  }

  if (identity.kind === 'page') {
    const key = routePageRefKey(identity.page);
    return tabs.find((tab) => isPageTab(tab) && routePageRefKey(tab.page) === key)?.tabId;
  }

  if (identity.kind === 'markdown') {
    if (typeof identity.documentUuid === 'string' && identity.documentUuid.length > 0) {
      for (const tab of tabs) {
        if (!isMarkdownTab(tab)) {
          continue;
        }
        const uuid = findDocumentUuid(state, tab.docId);
        if (uuid === identity.documentUuid) {
          return tab.tabId;
        }
      }
    }
    return tabs.find((tab) => isMarkdownTab(tab) && tab.docId === identity.documentId)?.tabId;
  }

  const byUuid = findSavedRequestByUuid(state, identity.requestUuid);
  const requestId = byUuid?.id ?? identity.requestId;
  if (typeof requestId !== 'number') {
    return undefined;
  }
  return tabs.find((tab) => isRequestTab(tab) && tab.draft.id === requestId)?.tabId;
}

/**
 * Narrows unknown payload into a tab identity when it looks valid.
 *
 * @param value - Recorded tab identity payload.
 * @returns Typed identity, or null.
 */
export function parseWorkflowTabIdentity(value: unknown): WorkflowTabIdentity | null {
  if (typeof value !== 'object' || value == null || !('kind' in value)) {
    return null;
  }
  const identity = value as WorkflowTabIdentity;
  if (identity.kind === 'blank') {
    return { kind: 'blank' };
  }
  if (identity.kind === 'request' && typeof identity.requestUuid === 'string') {
    return {
      kind: 'request',
      requestUuid: identity.requestUuid,
      requestId: typeof identity.requestId === 'number' ? identity.requestId : undefined
    };
  }
  if (identity.kind === 'page' && identity.page != null && typeof identity.page === 'object') {
    return { kind: 'page', page: identity.page };
  }
  if (identity.kind === 'markdown' && typeof identity.documentId === 'number') {
    return {
      kind: 'markdown',
      documentId: identity.documentId,
      documentUuid: typeof identity.documentUuid === 'string' ? identity.documentUuid : undefined
    };
  }
  return null;
}

/**
 * Resolves a workspace id for playback from recorded id and/or name.
 *
 * @param state - Root Redux state.
 * @param payload - Recorded workspace.open payload.
 * @returns Workspace id, or null when not found.
 */
export function resolveWorkspaceIdForPlayback(
  state: RootState,
  payload: { id?: unknown; name?: unknown }
): number | null {
  const workspaces = selectWorkspaces(state);
  if (typeof payload.id === 'number') {
    const byId = workspaces.find((workspace) => workspace.id === payload.id);
    if (byId != null) {
      return byId.id;
    }
  }
  if (typeof payload.name === 'string' && payload.name.length > 0) {
    const byName = workspaces.find((workspace) => workspace.name === payload.name);
    if (byName != null) {
      return byName.id;
    }
  }
  return null;
}
