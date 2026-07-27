import type { CollectionDocument, SavedRequest } from '@harborclient/core/types';
import type { SidebarSelection } from '@harborclient/sdk';
import type { RootState } from '#/renderer/src/store/redux';
import { store } from '#/renderer/src/store/redux';
import { selectActiveTab } from '#/renderer/src/store/selectors';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import { isMarkdownTab, isRequestTab } from '#/renderer/src/store/tabs';
import { focusSidebarItem } from '#/renderer/src/store/thunks/collections';
import { requestLoadDocument } from '#/renderer/src/store/thunks/documents';
import { requestLoadRequest } from '#/renderer/src/store/thunks/requests';
import { findSavedRequest } from './hostRequestCommands';

/**
 * Builds the sidebar focus payload when opening a saved request so git-backed
 * collections and folder highlights follow the opened item.
 *
 * @param req - Saved request whose parent collection and folder should be selected.
 * @returns Payload for {@link focusSidebarItem}.
 */
export function sidebarFocusPayloadForRequest(
  req: Pick<SavedRequest, 'collection_id' | 'folder_id'>
): { collectionId: number; folderId: number | null } {
  return { collectionId: req.collection_id, folderId: req.folder_id ?? null };
}

/**
 * Builds the sidebar focus payload when opening a markdown document so git-backed
 * collections and folder highlights follow the opened item.
 *
 * @param doc - Document whose parent collection and folder should be selected.
 * @returns Payload for {@link focusSidebarItem}.
 */
export function sidebarFocusPayloadForDocument(
  doc: Pick<CollectionDocument, 'collection_id' | 'folder_id'>
): { collectionId: number; folderId: number | null } {
  return { collectionId: doc.collection_id, folderId: doc.folder_id ?? null };
}

/**
 * Finds a cached markdown document by id across loaded collection caches.
 *
 * @param state - Current renderer store state.
 * @param documentId - Collection document database id.
 * @returns Matching document, if loaded in memory.
 */
export function findCachedDocument(
  state: RootState,
  documentId: number
): CollectionDocument | undefined {
  for (const documents of Object.values(state.collections.documentsByCollection)) {
    const match = documents.find((document) => document.id === documentId);
    if (match) {
      return match;
    }
  }
  return undefined;
}

/**
 * Derives a serializable sidebar selection from Redux navigation state.
 *
 * Priority: active saved request/document tab → selected folder → selected
 * collection → null. Matches reveal-in-sidebar / breadcrumb host behavior.
 *
 * @param state - Current renderer store state.
 * @returns Current selection, or null when nothing is focused.
 */
export function selectionFromState(state: RootState): SidebarSelection | null {
  const activeTab = selectActiveTab(state);
  if (activeTab != null && isRequestTab(activeTab) && activeTab.draft.id != null) {
    const collectionId = activeTab.draft.collection_id ?? state.collections.selectedCollectionId;
    if (collectionId == null) {
      return null;
    }
    return {
      kind: 'request',
      collectionId,
      folderId: activeTab.draft.folder_id ?? null,
      requestId: activeTab.draft.id
    };
  }
  if (activeTab != null && isMarkdownTab(activeTab)) {
    return {
      kind: 'document',
      collectionId: activeTab.collectionId,
      folderId: activeTab.folderId,
      documentId: activeTab.docId
    };
  }

  const { selectedCollectionId, selectedFolderId } = state.collections;
  if (selectedCollectionId == null) {
    return null;
  }
  if (selectedFolderId != null) {
    return {
      kind: 'folder',
      collectionId: selectedCollectionId,
      folderId: selectedFolderId
    };
  }
  return { kind: 'collection', collectionId: selectedCollectionId };
}

/**
 * Returns whether two sidebar selections refer to the same entity.
 *
 * @param a - First selection (or null).
 * @param b - Second selection (or null).
 * @returns True when both are null or describe the same kind and ids.
 */
export function selectionsEqual(a: SidebarSelection | null, b: SidebarSelection | null): boolean {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (a.kind !== b.kind) {
    return false;
  }
  switch (a.kind) {
    case 'collection':
      return (
        a.collectionId === (b as Extract<SidebarSelection, { kind: 'collection' }>).collectionId
      );
    case 'folder': {
      const other = b as Extract<SidebarSelection, { kind: 'folder' }>;
      return a.collectionId === other.collectionId && a.folderId === other.folderId;
    }
    case 'request': {
      const other = b as Extract<SidebarSelection, { kind: 'request' }>;
      return (
        a.collectionId === other.collectionId &&
        a.folderId === other.folderId &&
        a.requestId === other.requestId
      );
    }
    case 'document': {
      const other = b as Extract<SidebarSelection, { kind: 'document' }>;
      return (
        a.collectionId === other.collectionId &&
        a.folderId === other.folderId &&
        a.documentId === other.documentId
      );
    }
    default:
      return false;
  }
}

/**
 * Validates a plugin-provided sidebar selection payload.
 *
 * @param selection - Raw selection from a plugin host call.
 * @returns Normalized selection, or null when clearing.
 * @throws When the payload shape is invalid.
 */
export function validateSidebarSelection(selection: unknown): SidebarSelection | null {
  if (selection === null) {
    return null;
  }
  if (!selection || typeof selection !== 'object') {
    throw new Error('harborclient.setSidebarSelection requires a selection object or null.');
  }
  const raw = selection as SidebarSelection;
  if (typeof raw.kind !== 'string') {
    throw new Error('harborclient.setSidebarSelection requires a kind field.');
  }
  switch (raw.kind) {
    case 'collection':
      if (typeof raw.collectionId !== 'number') {
        throw new Error('harborclient.setSidebarSelection collection requires collectionId.');
      }
      return { kind: 'collection', collectionId: raw.collectionId };
    case 'folder':
      if (typeof raw.collectionId !== 'number' || typeof raw.folderId !== 'number') {
        throw new Error(
          'harborclient.setSidebarSelection folder requires collectionId and folderId.'
        );
      }
      return { kind: 'folder', collectionId: raw.collectionId, folderId: raw.folderId };
    case 'request':
      if (typeof raw.collectionId !== 'number' || typeof raw.requestId !== 'number') {
        throw new Error(
          'harborclient.setSidebarSelection request requires collectionId and requestId.'
        );
      }
      if (raw.folderId !== null && typeof raw.folderId !== 'number') {
        throw new Error(
          'harborclient.setSidebarSelection request folderId must be number or null.'
        );
      }
      return {
        kind: 'request',
        collectionId: raw.collectionId,
        folderId: raw.folderId ?? null,
        requestId: raw.requestId
      };
    case 'document':
      if (typeof raw.collectionId !== 'number' || typeof raw.documentId !== 'number') {
        throw new Error(
          'harborclient.setSidebarSelection document requires collectionId and documentId.'
        );
      }
      if (raw.folderId !== null && typeof raw.folderId !== 'number') {
        throw new Error(
          'harborclient.setSidebarSelection document folderId must be number or null.'
        );
      }
      return {
        kind: 'document',
        collectionId: raw.collectionId,
        folderId: raw.folderId ?? null,
        documentId: raw.documentId
      };
    default:
      throw new Error(
        `harborclient.setSidebarSelection unknown kind: ${(raw as { kind: string }).kind}`
      );
  }
}

/**
 * Applies a sidebar selection to host Redux the same way the built-in tree does.
 *
 * Request and document selections also open/focus the corresponding editor tab.
 *
 * @param selection - Target selection, or null to clear highlights.
 */
export function applySidebarSelection(selection: SidebarSelection | null): void {
  if (selection == null) {
    store.dispatch(setSelectedCollectionId(null));
    return;
  }

  switch (selection.kind) {
    case 'collection':
      store.dispatch(focusSidebarItem({ collectionId: selection.collectionId }));
      return;
    case 'folder':
      store.dispatch(
        focusSidebarItem({
          collectionId: selection.collectionId,
          folderId: selection.folderId
        })
      );
      return;
    case 'request': {
      const state = store.getState();
      const openTab = state.tabs.tabs.find(
        (tab) => isRequestTab(tab) && tab.draft.id === selection.requestId
      );
      store.dispatch(
        focusSidebarItem({
          collectionId: selection.collectionId,
          folderId: selection.folderId
        })
      );
      if (openTab) {
        store.dispatch(setActiveTab(openTab.tabId));
        return;
      }
      const saved = findSavedRequest(state, selection.requestId);
      if (!saved) {
        throw new Error(
          `Request ${selection.requestId} is not available. Open its collection first.`
        );
      }
      void store.dispatch(requestLoadRequest({ req: saved }));
      return;
    }
    case 'document': {
      const state = store.getState();
      const doc = findCachedDocument(state, selection.documentId);
      if (!doc) {
        throw new Error(
          `Document ${selection.documentId} is not available. Open its collection first.`
        );
      }
      store.dispatch(focusSidebarItem(sidebarFocusPayloadForDocument(doc)));
      void store.dispatch(requestLoadDocument({ doc }));
      return;
    }
  }
}
