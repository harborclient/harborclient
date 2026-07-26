import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type { SavedRequest } from '@harborclient/core/types';
import type {
  Workspace,
  WorkspaceExport,
  WorkspaceRequest
} from '@harborclient/core/types/workspace';
import { isRequestTab, type Tab } from '#/renderer/src/store/tabs';
import { loadRequest, setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  reorderWorkspacesLocal,
  setWorkspaces,
  selectWorkspaces,
  startEditingWorkspace,
  stopEditingWorkspace,
  selectEditingWorkspaceId,
  selectEditSessionHiddenTabIds
} from '#/renderer/src/store/slices/workspaceSlice';
import { openWorkspaceModal } from '#/renderer/src/store/slices/modalsSlice';
import { refreshRequests } from './collections';
import { patchGeneralSettings } from './settings';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import { syncTrash } from './trash';
import { showConfirm } from '#/renderer/src/ui/Modals/dialogHelpers';
import { applyWorkspaceLayout, captureWorkspaceLayout } from './workspaceLayout';

/**
 * Finds a saved request by uuid, preferring the stored collection id when present.
 *
 * @param requestsByCollection - Cached requests keyed by collection id.
 * @param member - Workspace member reference.
 * @returns Matching saved request, if any.
 */
function findSavedRequestByUuid(
  requestsByCollection: Record<number, SavedRequest[]>,
  member: WorkspaceRequest
): SavedRequest | undefined {
  if (member.collectionId != null) {
    return (requestsByCollection[member.collectionId] ?? []).find(
      (request) => request.uuid === member.requestUuid
    );
  }

  for (const requests of Object.values(requestsByCollection)) {
    const match = requests.find((request) => request.uuid === member.requestUuid);
    if (match) {
      return match;
    }
  }

  return undefined;
}

/**
 * Returns whether a tab is an open saved collection request.
 *
 * @param tab - Open editor tab to evaluate.
 * @returns True when the tab is a saved request with a collection id.
 */
export function isOpenSavedRequestTab(
  tab: Tab
): tab is Tab & { draft: { id: number; collection_id: number } } {
  return isRequestTab(tab) && tab.draft.id != null && tab.draft.collection_id != null;
}

/**
 * Resolves the saved request uuid for an open saved request tab.
 *
 * @param tab - Open editor tab to evaluate.
 * @param requestsByCollection - Cached saved requests keyed by collection id.
 * @returns Request uuid when the tab references a saved request.
 */
function resolveOpenTabRequestUuid(
  tab: Tab,
  requestsByCollection: Record<number, SavedRequest[]>
): string | undefined {
  if (!isOpenSavedRequestTab(tab)) {
    return undefined;
  }

  const saved = (requestsByCollection[tab.draft.collection_id] ?? []).find(
    (request) => request.id === tab.draft.id
  );
  return saved?.uuid;
}

/**
 * Resolves workspace members from all open saved request tabs.
 *
 * @param tabs - Open editor tabs in display order.
 * @param requestsByCollection - Cached saved requests keyed by collection id.
 * @returns Ordered workspace members for persistence, deduped by request uuid.
 */
export function resolveWorkspaceMembersFromOpenTabs(
  tabs: Tab[],
  requestsByCollection: Record<number, SavedRequest[]>
): WorkspaceRequest[] {
  const members: WorkspaceRequest[] = [];
  const seenUuids = new Set<string>();

  for (const tab of tabs) {
    if (!isOpenSavedRequestTab(tab)) {
      continue;
    }

    const collectionId = tab.draft.collection_id;
    const requestId = tab.draft.id;
    const saved = (requestsByCollection[collectionId] ?? []).find(
      (request) => request.id === requestId
    );
    if (!saved || seenUuids.has(saved.uuid)) {
      continue;
    }

    seenUuids.add(saved.uuid);
    members.push({
      requestUuid: saved.uuid,
      collectionId,
      requestName: saved.name
    });
  }

  return members;
}

/**
 * Refreshes the workspace list from the local registry.
 */
export const refreshWorkspaces = createAsyncThunk<void, void, ThunkApiConfig>(
  'workspaces/refresh',
  async (_arg, { dispatch }) => {
    const items = await window.api.listWorkspaces();
    dispatch(setWorkspaces(items));
  }
);

/**
 * Prompts before opening the create workspace modal, then opens it when confirmed.
 */
export const requestCreateWorkspaceFromOpenTabs = createAsyncThunk<void, void, ThunkApiConfig>(
  'workspaces/requestCreateFromOpenTabs',
  async (_arg, { dispatch, getState }) => {
    const warnWhenCreatingWorkspace = getState().settings.general.warnWhenCreatingWorkspace;

    if (warnWhenCreatingWorkspace) {
      const result = await showConfirm(dispatch as AppDispatch, {
        title: 'Create workspace?',
        message:
          'The workspace will be created from the currently opened request tabs, along with the current layout, theme, and environment.',
        confirmLabel: 'Create workspace',
        checkboxLabel: "Don't show this again"
      });
      if (!result.confirmed) {
        return;
      }
      if (result.checkboxChecked) {
        await dispatch(patchGeneralSettings({ warnWhenCreatingWorkspace: false }));
      }
    }

    dispatch(openWorkspaceModal({ mode: 'create' }));
  }
);

/**
 * Builds workspace members from saved requests in caller order.
 *
 * @param requests - Saved requests to include in the workspace.
 * @returns Ordered workspace members for persistence, deduped by request uuid.
 */
export function resolveWorkspaceMembersFromRequests(requests: SavedRequest[]): WorkspaceRequest[] {
  const members: WorkspaceRequest[] = [];
  const seenUuids = new Set<string>();

  for (const request of requests) {
    if (seenUuids.has(request.uuid)) {
      continue;
    }
    seenUuids.add(request.uuid);
    members.push({
      requestUuid: request.uuid,
      collectionId: request.collection_id,
      requestName: request.name
    });
  }

  return members;
}

/**
 * Creates a workspace from all open saved request tabs.
 */
export const createWorkspaceFromOpenTabs = createAsyncThunk<void, string, ThunkApiConfig>(
  'workspaces/createFromOpenTabs',
  async (name, { dispatch, getState }) => {
    const state = getState();
    const tabs = state.tabs.tabs;
    const requestsByCollection = state.collections.requestsByCollection;

    const collectionsToRefresh = new Set<number>();
    for (const tab of tabs) {
      if (!isOpenSavedRequestTab(tab)) {
        continue;
      }
      const collectionId = tab.draft.collection_id;
      if (!requestsByCollection[collectionId]) {
        collectionsToRefresh.add(collectionId);
      }
    }

    for (const collectionId of collectionsToRefresh) {
      await dispatch(refreshRequests(collectionId));
    }

    const members = resolveWorkspaceMembersFromOpenTabs(
      tabs,
      getState().collections.requestsByCollection
    );

    if (members.length === 0) {
      throw new Error('No open requests to add');
    }

    const layout = await captureWorkspaceLayout(getState());
    const items = await window.api.createWorkspace({ name, requests: members, layout });
    dispatch(setWorkspaces(items));
  }
);

/**
 * Creates a workspace from an explicit saved request list.
 */
export const createWorkspaceFromRequests = createAsyncThunk<
  void,
  { name: string; requests: SavedRequest[] },
  ThunkApiConfig
>('workspaces/createFromRequests', async ({ name, requests }, { dispatch, getState }) => {
  const members = resolveWorkspaceMembersFromRequests(requests);

  if (members.length === 0) {
    throw new Error('No requests to add');
  }

  const layout = await captureWorkspaceLayout(getState());
  const items = await window.api.createWorkspace({ name, requests: members, layout });
  dispatch(setWorkspaces(items));
});

/**
 * Renames a workspace and refreshes the cached list.
 */
export const renameWorkspace = createAsyncThunk<void, { id: number; name: string }, ThunkApiConfig>(
  'workspaces/rename',
  async ({ id, name }, { dispatch }) => {
    const items = await window.api.renameWorkspace(id, name);
    dispatch(setWorkspaces(items));
  }
);

/**
 * Clones a workspace under a new name and refreshes the cached list.
 */
export const cloneWorkspace = createAsyncThunk<void, { id: number; name: string }, ThunkApiConfig>(
  'workspaces/clone',
  async ({ id, name }, { dispatch }) => {
    const items = await window.api.cloneWorkspace(id, name);
    dispatch(setWorkspaces(items));
  }
);

/**
 * Deletes a workspace and refreshes the cached list.
 */
export const deleteWorkspace = createAsyncThunk<void, number, ThunkApiConfig>(
  'workspaces/delete',
  async (id, { dispatch }) => {
    const items = await window.api.deleteWorkspace(id);
    dispatch(setWorkspaces(items));
    await syncTrash(dispatch);
  }
);

/**
 * Persists a new sidebar order for workspaces and refreshes the cached list.
 */
export const reorderWorkspaces = createAsyncThunk<void, number[], ThunkApiConfig>(
  'workspaces/reorder',
  async (orderedWorkspaceIds, { dispatch }) => {
    dispatch(reorderWorkspacesLocal(orderedWorkspaceIds));
    const items = await window.api.reorderWorkspaces(orderedWorkspaceIds);
    dispatch(setWorkspaces(items));
  }
);

/**
 * Persists a workspace sidebar marker and refreshes the cached list.
 */
export const setWorkspaceSidebarMarker = createAsyncThunk<
  Workspace[],
  { id: number; marker: string | null },
  ThunkApiConfig
>('workspaces/setSidebarMarker', async ({ id, marker }, { dispatch }) => {
  const items = await window.api.setWorkspaceMarker(id, marker);
  dispatch(setWorkspaces(items));
  return items;
});

/**
 * Builds a portable workspace export envelope from a group id.
 *
 * @param groupId - Workspace to export.
 * @param groups - Loaded workspaces from the store.
 * @returns Export envelope with request uuids only.
 */
export function buildWorkspaceExport(groupId: number, groups: Workspace[]): WorkspaceExport {
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) {
    throw new Error(`Workspace ${groupId} not found`);
  }

  return {
    harborclientVersion: 2,
    harborclientExport: 'workspace',
    name: group.name,
    requestUuids: group.requests.map((request) => request.requestUuid),
    marker: group.marker ?? null,
    layout: group.layout ?? null
  };
}

/**
 * Exports a workspace to a JSON file via the native save dialog.
 */
export const exportWorkspace = createAsyncThunk<void, number, ThunkApiConfig>(
  'workspaces/export',
  async (groupId, { getState }) => {
    const envelope = buildWorkspaceExport(groupId, selectWorkspaces(getState()));
    const result = await window.api.saveTextFile(
      JSON.stringify(envelope, null, 2),
      `${envelope.name}.json`
    );
    if (!result.canceled) {
      toast.success('Workspace exported');
    }
  }
);

/**
 * Prompts before opening a workspace from the sidebar, then opens it when confirmed.
 */
export const requestOpenWorkspace = createAsyncThunk<void, number, ThunkApiConfig>(
  'workspaces/requestOpen',
  async (groupId, { dispatch, getState }) => {
    const warnWhenOpeningWorkspace = getState().settings.general.warnWhenOpeningWorkspace;

    if (warnWhenOpeningWorkspace) {
      const result = await showConfirm(dispatch as AppDispatch, {
        title: 'Open workspace?',
        message:
          'All saved requests in this workspace will be opened, and the saved layout, theme, and environment will be restored.',
        confirmLabel: 'Open',
        checkboxLabel: "Don't show again"
      });
      if (!result.confirmed) {
        return;
      }
      if (result.checkboxChecked) {
        await dispatch(patchGeneralSettings({ warnWhenOpeningWorkspace: false }));
      }
    }

    await dispatch(openWorkspace(groupId));
  }
);

/**
 * Opens every saved request in a workspace without duplicating existing tabs.
 */
export const openWorkspace = createAsyncThunk<void, number, ThunkApiConfig>(
  'workspaces/open',
  async (groupId, { dispatch, getState }) => {
    const group = selectWorkspaces(getState()).find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }

    const collectionsToRefresh = new Set<number>();
    for (const member of group.requests) {
      if (member.collectionId != null) {
        collectionsToRefresh.add(member.collectionId);
      }
    }

    for (const collectionId of collectionsToRefresh) {
      if (!getState().collections.requestsByCollection[collectionId]) {
        await dispatch(refreshRequests(collectionId));
      }
    }

    let firstOpened = false;
    let missingCount = 0;
    const requestsByCollection = getState().collections.requestsByCollection;

    for (const member of group.requests) {
      const saved = findSavedRequestByUuid(requestsByCollection, member);
      if (!saved) {
        missingCount += 1;
        continue;
      }

      dispatch(loadRequest({ req: saved, activate: !firstOpened }));
      if (!firstOpened) {
        firstOpened = true;
      }
    }

    if (missingCount > 0) {
      toast.error(
        missingCount === 1
          ? '1 request in this workspace could not be opened'
          : `${missingCount} requests in this workspace could not be opened`
      );
    }

    if (group.layout) {
      await applyWorkspaceLayout(group.layout, dispatch as AppDispatch, getState);
    }
  }
);

/**
 * Enters workspace edit mode, opening members and hiding unrelated open tabs.
 */
export const editWorkspace = createAsyncThunk<void, number, ThunkApiConfig>(
  'workspaces/edit',
  async (groupId, { dispatch, getState }) => {
    await dispatch(openWorkspace(groupId));

    const state = getState();
    const group = selectWorkspaces(state).find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }

    const memberUuids = new Set(group.requests.map((request) => request.requestUuid));
    const requestsByCollection = state.collections.requestsByCollection;
    const tabs = state.tabs.tabs;
    const hiddenTabIds: string[] = [];

    for (const tab of tabs) {
      const requestUuid = resolveOpenTabRequestUuid(tab, requestsByCollection);
      if (requestUuid == null || !memberUuids.has(requestUuid)) {
        hiddenTabIds.push(tab.tabId);
      }
    }

    dispatch(startEditingWorkspace({ groupId, hiddenTabIds }));

    const activeTabId = state.tabs.activeTabId;
    if (activeTabId != null && hiddenTabIds.includes(activeTabId)) {
      const firstVisibleTab = tabs.find((tab) => !hiddenTabIds.includes(tab.tabId));
      if (firstVisibleTab != null) {
        dispatch(setActiveTab(firstVisibleTab.tabId));
      }
    }
  }
);

/**
 * Persists workspace membership from visible open tabs and exits edit mode.
 */
export const saveWorkspaceEdit = createAsyncThunk<void, void, ThunkApiConfig>(
  'workspaces/saveEdit',
  async (_arg, { dispatch, getState }) => {
    const state = getState();
    const editingWorkspaceId = selectEditingWorkspaceId(state);
    if (editingWorkspaceId == null) {
      return;
    }

    const hiddenTabIds = new Set(selectEditSessionHiddenTabIds(state));
    const visibleTabs = state.tabs.tabs.filter((tab) => !hiddenTabIds.has(tab.tabId));
    const requestsByCollection = state.collections.requestsByCollection;

    const collectionsToRefresh = new Set<number>();
    for (const tab of visibleTabs) {
      if (!isOpenSavedRequestTab(tab)) {
        continue;
      }
      const collectionId = tab.draft.collection_id;
      if (!requestsByCollection[collectionId]) {
        collectionsToRefresh.add(collectionId);
      }
    }

    for (const collectionId of collectionsToRefresh) {
      await dispatch(refreshRequests(collectionId));
    }

    const members = resolveWorkspaceMembersFromOpenTabs(
      visibleTabs,
      getState().collections.requestsByCollection
    );

    if (members.length === 0) {
      throw new Error('No open requests to add');
    }

    const layout = await captureWorkspaceLayout(getState());
    const items = await window.api.updateWorkspace(editingWorkspaceId, members, layout);
    dispatch(setWorkspaces(items));
    dispatch(stopEditingWorkspace());
    toast.success('Workspace saved');
  }
);

/**
 * Exits workspace edit mode without persisting changes.
 */
export const cancelWorkspaceEdit = createAsyncThunk<void, void, ThunkApiConfig>(
  'workspaces/cancelEdit',
  async (_arg, { dispatch }) => {
    dispatch(stopEditingWorkspace());
  }
);
