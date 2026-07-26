import type {
  Collection,
  CollectionDocument,
  Folder,
  HttpMethod,
  SavedRequest
} from '@harborclient/core/types';

/**
 * Normalizes a CSS color string to lowercase for comparison.
 *
 * @param value - Raw color string from storage or user input.
 */
function normalizeCssColor(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns whether two CSS color strings represent the same color.
 *
 * @param a - First color string.
 * @param b - Second color string.
 */
function colorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) {
    return false;
  }
  return normalizeCssColor(a) === normalizeCssColor(b);
}

/**
 * Document-type filter values for the Collections section filter form.
 */
export type CollectionsFilterDocumentType = 'request' | 'document';

/**
 * Applied (or draft) criteria for filtering the Collections sidebar tree.
 * Null fields mean “any” / inactive for that dimension.
 */
export interface CollectionsFilterCriteria {
  /**
   * Storage connection id to match against collection `connectionId`, or null for all.
   */
  storageLocationId: string | null;

  /**
   * HTTP method to match against saved requests, or null for all methods.
   */
  method: HttpMethod | null;

  /**
   * Whether to show only requests or only markdown documents, or null for both.
   */
  documentType: CollectionsFilterDocumentType | null;

  /**
   * CSS color string to match against sidebar item colors, or null for all colors.
   */
  color: string | null;
}

/**
 * Visibility sets used to prune the collections tree when a filter is active.
 */
export interface CollectionsTreeFilter {
  /**
   * Collection rows to show.
   */
  collectionIds: ReadonlySet<number>;

  /**
   * Folder rows to show within visible collections.
   */
  folderIds: ReadonlySet<number>;

  /**
   * Request rows to show within visible collections and folders.
   */
  requestIds: ReadonlySet<number>;

  /**
   * Markdown document rows to show within visible collections and folders.
   */
  documentIds: ReadonlySet<number>;
}

/**
 * Sidebar entity maps passed into the collections tree filter builder.
 */
export interface CollectionsFilterInput {
  /**
   * Collections in sidebar display order.
   */
  collections: Collection[];

  /**
   * Folders grouped by collection id.
   */
  foldersByCollection: Record<number, Folder[]>;

  /**
   * Saved requests grouped by collection id.
   */
  requestsByCollection: Record<number, SavedRequest[]>;

  /**
   * Markdown documents grouped by collection id.
   */
  documentsByCollection: Record<number, CollectionDocument[]>;

  /**
   * Fallback connection id when a collection has no explicit `connectionId`.
   */
  primaryConnectionId: string;
}

/**
 * Empty / inactive collections filter (all criteria unset).
 */
export const EMPTY_COLLECTIONS_FILTER: CollectionsFilterCriteria = {
  storageLocationId: null,
  method: null,
  documentType: null,
  color: null
};

/**
 * Returns whether any collections filter criterion is currently set.
 *
 * @param criteria - Applied or draft filter criteria.
 */
export function isCollectionsFilterActive(criteria: CollectionsFilterCriteria): boolean {
  return (
    criteria.storageLocationId != null ||
    criteria.method != null ||
    criteria.documentType != null ||
    criteria.color != null
  );
}

/**
 * Returns whether the filter has leaf-item criteria (method, document type, or color).
 * When only storage location is set, the entire matching collection trees are shown.
 *
 * @param criteria - Applied or draft filter criteria.
 */
function hasLeafFilterCriteria(criteria: CollectionsFilterCriteria): boolean {
  return criteria.method != null || criteria.documentType != null || criteria.color != null;
}

/**
 * Collects unique CSS colors assigned to collections-tree items (collections,
 * folders, requests, and markdown documents), sorted for stable UI order.
 *
 * @param input - Sidebar entity maps currently available in the renderer store.
 * @returns Deduplicated color strings (normalized for comparison, original first-seen form kept).
 */
export function collectCollectionsTreeColors(input: CollectionsFilterInput): string[] {
  const seen = new Map<string, string>();

  /**
   * Records a color if non-empty and not already present under a matching key.
   *
   * @param color - Optional CSS color from a sidebar entity.
   */
  const addColor = (color: string | null | undefined): void => {
    if (color == null || color.trim() === '') {
      return;
    }
    const key = normalizeCssColor(color);
    if (!seen.has(key)) {
      seen.set(key, color.trim());
    }
  };

  for (const collection of input.collections) {
    addColor(collection.color);
  }

  for (const folders of Object.values(input.foldersByCollection)) {
    for (const folder of folders) {
      addColor(folder.color);
    }
  }

  for (const requests of Object.values(input.requestsByCollection)) {
    for (const request of requests) {
      addColor(request.color);
    }
  }

  for (const documents of Object.values(input.documentsByCollection)) {
    for (const document of documents) {
      addColor(document.color);
    }
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * A storage location option derived from collections present in the sidebar tree.
 */
export interface CollectionsTreeStorageLocation {
  /**
   * Storage connection id used as the filter value.
   */
  id: string;

  /**
   * Display name for the select option.
   */
  name: string;
}

/**
 * Collects distinct storage locations used by collections in the sidebar tree.
 * Resolves each collection via `connectionId ?? primaryConnectionId`, deduplicates
 * by id, and sorts by display name.
 *
 * @param collections - Collections currently shown in the sidebar.
 * @param primaryConnectionId - Fallback when a collection has no explicit connection.
 * @param connectionNamesById - Human-readable names keyed by connection id.
 * @returns Storage location options for the Collections filter select.
 */
export function collectCollectionsTreeStorageLocations(
  collections: Collection[],
  primaryConnectionId: string,
  connectionNamesById: Record<string, string>
): CollectionsTreeStorageLocation[] {
  const byId = new Map<string, CollectionsTreeStorageLocation>();

  for (const collection of collections) {
    const id = collectionConnectionId(collection, primaryConnectionId);
    if (byId.has(id)) {
      continue;
    }
    const name = connectionNamesById[id]?.trim();
    byId.set(id, {
      id,
      name: name && name.length > 0 ? name : id
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolves the effective storage connection id for a collection.
 *
 * @param collection - Collection row.
 * @param primaryConnectionId - Fallback when `connectionId` is unset.
 */
function collectionConnectionId(collection: Collection, primaryConnectionId: string): string {
  return collection.connectionId ?? primaryConnectionId;
}

/**
 * Returns whether a request row satisfies the active leaf filter criteria.
 *
 * @param request - Saved request to evaluate.
 * @param criteria - Active filter criteria.
 */
function requestMatchesCriteria(
  request: SavedRequest,
  criteria: CollectionsFilterCriteria
): boolean {
  if (criteria.documentType != null && criteria.documentType !== 'request') {
    return false;
  }
  if (criteria.method != null && request.method !== criteria.method) {
    return false;
  }
  if (criteria.color != null && !colorsMatch(request.color, criteria.color)) {
    return false;
  }
  return true;
}

/**
 * Returns whether a markdown document row satisfies the active leaf filter criteria.
 * Method filters apply only to HTTP requests, so an active method excludes documents.
 *
 * @param document - Collection document to evaluate.
 * @param criteria - Active filter criteria.
 */
function documentMatchesCriteria(
  document: CollectionDocument,
  criteria: CollectionsFilterCriteria
): boolean {
  if (criteria.method != null) {
    return false;
  }
  if (criteria.documentType != null && criteria.documentType !== 'document') {
    return false;
  }
  if (criteria.color != null && !colorsMatch(document.color, criteria.color)) {
    return false;
  }
  return true;
}

/**
 * Builds hierarchical visibility sets for the Collections sidebar tree from
 * filter criteria. Returns null when no criteria are active.
 *
 * @param input - Sidebar entity maps currently available in the renderer store.
 * @param criteria - Applied collections filter criteria.
 * @returns Visibility sets, or null when the filter is inactive.
 */
export function buildCollectionsTreeFilter(
  input: CollectionsFilterInput,
  criteria: CollectionsFilterCriteria
): CollectionsTreeFilter | null {
  if (!isCollectionsFilterActive(criteria)) {
    return null;
  }

  const collectionIds = new Set<number>();
  const folderIds = new Set<number>();
  const requestIds = new Set<number>();
  const documentIds = new Set<number>();

  const leafCriteriaActive = hasLeafFilterCriteria(criteria);

  for (const collection of input.collections) {
    const connectionId = collectionConnectionId(collection, input.primaryConnectionId);
    if (criteria.storageLocationId != null && connectionId !== criteria.storageLocationId) {
      continue;
    }

    if (!leafCriteriaActive) {
      collectionIds.add(collection.id);
      for (const folder of input.foldersByCollection[collection.id] ?? []) {
        folderIds.add(folder.id);
      }
      for (const request of input.requestsByCollection[collection.id] ?? []) {
        requestIds.add(request.id);
      }
      for (const document of input.documentsByCollection[collection.id] ?? []) {
        documentIds.add(document.id);
      }
      continue;
    }

    const collectionColorMatch =
      criteria.color != null && colorsMatch(collection.color, criteria.color);
    let hasVisibleDescendant = false;

    for (const request of input.requestsByCollection[collection.id] ?? []) {
      if (!requestMatchesCriteria(request, criteria)) {
        continue;
      }
      requestIds.add(request.id);
      hasVisibleDescendant = true;
      if (request.folder_id != null) {
        folderIds.add(request.folder_id);
      }
    }

    for (const document of input.documentsByCollection[collection.id] ?? []) {
      if (!documentMatchesCriteria(document, criteria)) {
        continue;
      }
      documentIds.add(document.id);
      hasVisibleDescendant = true;
      if (document.folder_id != null) {
        folderIds.add(document.folder_id);
      }
    }

    for (const folder of input.foldersByCollection[collection.id] ?? []) {
      const folderColorMatch = criteria.color != null && colorsMatch(folder.color, criteria.color);
      if (folderColorMatch) {
        folderIds.add(folder.id);
        hasVisibleDescendant = true;
      }
    }

    if (collectionColorMatch || hasVisibleDescendant) {
      collectionIds.add(collection.id);
    }
  }

  return {
    collectionIds,
    folderIds,
    requestIds,
    documentIds
  };
}
