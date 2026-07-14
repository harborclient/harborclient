import type { CollectionDocument, SavedRequest } from '#/shared/types';

/**
 * Inputs for deciding whether a collection row should offer "Deselect all".
 */
export interface CollectionDeselectableSelectionInput {
  /**
   * Collection id currently highlighted in the sidebar, if any.
   */
  selectedCollectionId: number | null;

  /**
   * Folder id currently highlighted in the sidebar, if any.
   */
  selectedFolderId: number | null;

  /**
   * Request ids included in the current multi-selection.
   */
  selectedRequestIds: ReadonlySet<number>;

  /**
   * Saved requests grouped by collection id.
   */
  requestsByCollection: Readonly<Record<number, SavedRequest[]>>;

  /**
   * Markdown documents grouped by collection id.
   */
  documentsByCollection: Readonly<Record<number, CollectionDocument[]>>;

  /**
   * Saved request ids currently open in editor tabs.
   */
  openRequestIds: ReadonlySet<number>;

  /**
   * Markdown document ids currently open in editor tabs.
   */
  openDocumentIds: ReadonlySet<number>;
}

/**
 * Result of removing one collection's requests from the sidebar multi-selection.
 */
export interface RemoveCollectionRequestSelectionResult {
  /**
   * Updated request multi-selection after removing ids from the target collection.
   */
  selectedRequestIds: Set<number>;

  /**
   * Updated shift-click anchor, cleared when it pointed at a removed request.
   */
  selectionAnchorId: number | null;
}

/**
 * Returns request ids belonging to a single collection.
 *
 * @param collectionId - Collection whose requests should be resolved.
 * @param requestsByCollection - Saved requests grouped by collection id.
 * @returns Set of request ids owned by the collection.
 */
function requestIdsForCollection(
  collectionId: number,
  requestsByCollection: Readonly<Record<number, SavedRequest[]>>
): Set<number> {
  return new Set((requestsByCollection[collectionId] ?? []).map((request) => request.id));
}

/**
 * Returns whether a collection has open request or markdown tabs in the editor.
 *
 * @param collectionId - Collection whose open tabs should be checked.
 * @param openRequestIds - Saved request ids currently open in tabs.
 * @param openDocumentIds - Markdown document ids currently open in tabs.
 * @param requestsByCollection - Saved requests grouped by collection id.
 * @param documentsByCollection - Markdown documents grouped by collection id.
 * @returns True when at least one open tab belongs to the collection.
 */
function collectionHasOpenContentTabs(
  collectionId: number,
  openRequestIds: ReadonlySet<number>,
  openDocumentIds: ReadonlySet<number>,
  requestsByCollection: Readonly<Record<number, SavedRequest[]>>,
  documentsByCollection: Readonly<Record<number, CollectionDocument[]>>
): boolean {
  const collectionRequestIds = requestIdsForCollection(collectionId, requestsByCollection);
  for (const requestId of openRequestIds) {
    if (collectionRequestIds.has(requestId)) {
      return true;
    }
  }

  const collectionDocumentIds = new Set(
    (documentsByCollection[collectionId] ?? []).map((document) => document.id)
  );
  for (const documentId of openDocumentIds) {
    if (collectionDocumentIds.has(documentId)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns whether a collection menu should expose "Deselect all".
 *
 * The item appears when a folder in the collection is selected or when one or
 * more multi-selected requests belong to the collection. Collection row
 * highlight alone does not qualify.
 *
 * @param collectionId - Collection whose menu is being built.
 * @param input - Current sidebar selection state.
 * @returns True when deselectable child selection exists in the collection.
 */
export function collectionHasDeselectableSelection(
  collectionId: number,
  input: CollectionDeselectableSelectionInput
): boolean {
  const {
    selectedCollectionId,
    selectedFolderId,
    selectedRequestIds,
    requestsByCollection,
    documentsByCollection,
    openRequestIds,
    openDocumentIds
  } = input;

  if (selectedCollectionId === collectionId && selectedFolderId != null) {
    return true;
  }

  const collectionRequestIds = requestIdsForCollection(collectionId, requestsByCollection);
  for (const requestId of selectedRequestIds) {
    if (collectionRequestIds.has(requestId)) {
      return true;
    }
  }

  return collectionHasOpenContentTabs(
    collectionId,
    openRequestIds,
    openDocumentIds,
    requestsByCollection,
    documentsByCollection
  );
}

/**
 * Removes multi-selected requests belonging to one collection from the sidebar
 * selection model while preserving selections in other collections.
 *
 * @param collectionId - Collection whose request selections should be cleared.
 * @param selectedRequestIds - Current request multi-selection.
 * @param selectionAnchorId - Current shift-click anchor, if any.
 * @param requestsByCollection - Saved requests grouped by collection id.
 * @returns Updated multi-selection and anchor.
 */
export function removeCollectionRequestSelection(
  collectionId: number,
  selectedRequestIds: ReadonlySet<number>,
  selectionAnchorId: number | null,
  requestsByCollection: Readonly<Record<number, SavedRequest[]>>
): RemoveCollectionRequestSelectionResult {
  const collectionRequestIds = requestIdsForCollection(collectionId, requestsByCollection);
  const nextSelectedRequestIds = new Set(
    [...selectedRequestIds].filter((requestId) => !collectionRequestIds.has(requestId))
  );
  const nextSelectionAnchorId =
    selectionAnchorId != null && collectionRequestIds.has(selectionAnchorId)
      ? null
      : selectionAnchorId;

  return {
    selectedRequestIds: nextSelectedRequestIds,
    selectionAnchorId: nextSelectionAnchorId
  };
}
