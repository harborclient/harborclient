import type {
  Collection,
  CollectionDocument,
  Folder,
  HttpMethod,
  SavedRequest
} from '@harborclient/core/types';

/**
 * Normalizes a CSS marker string to lowercase for comparison.
 *
 * @param value - Raw marker string from storage or user input.
 */
function normalizeCssColor(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns whether two CSS marker strings represent the same marker.
 *
 * @param a - First marker string.
 * @param b - Second marker string.
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
   * HTTP method or SSE protocol to match against saved requests, or null for all.
   */
  method: HttpMethod | 'SSE' | null;

  /**
   * Whether to show only requests or only markdown documents, or null for both.
   */
  documentType: CollectionsFilterDocumentType | null;

  /**
   * CSS marker string to match against sidebar item markers, or null for all markers.
   */
  marker: string | null;
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
  marker: null
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
    criteria.marker != null
  );
}

/**
 * Returns whether the filter has leaf-item criteria (method, document type, or marker).
 * When only storage location is set, the entire matching collection trees are shown.
 *
 * @param criteria - Applied or draft filter criteria.
 */
function hasLeafFilterCriteria(criteria: CollectionsFilterCriteria): boolean {
  return criteria.method != null || criteria.documentType != null || criteria.marker != null;
}

/**
 * Collects unique CSS markers assigned to collections-tree items (collections,
 * folders, requests, and markdown documents), sorted for stable UI order.
 *
 * @param input - Sidebar entity maps currently available in the renderer store.
 * @returns Deduplicated marker strings (normalized for comparison, original first-seen form kept).
 */
export function collectCollectionsTreeMarkers(input: CollectionsFilterInput): string[] {
  const seen = new Map<string, string>();

  /**
   * Records a marker if non-empty and not already present under a matching key.
   *
   * @param marker - Optional CSS marker from a sidebar entity.
   */
  const addMarker = (marker: string | null | undefined): void => {
    if (marker == null || marker.trim() === '') {
      return;
    }
    const key = normalizeCssColor(marker);
    if (!seen.has(key)) {
      seen.set(key, marker.trim());
    }
  };

  for (const collection of input.collections) {
    addMarker(collection.marker);
  }

  for (const folders of Object.values(input.foldersByCollection)) {
    for (const folder of folders) {
      addMarker(folder.marker);
    }
  }

  for (const requests of Object.values(input.requestsByCollection)) {
    for (const request of requests) {
      addMarker(request.marker);
    }
  }

  for (const documents of Object.values(input.documentsByCollection)) {
    for (const document of documents) {
      addMarker(document.marker);
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
  if (criteria.method != null) {
    if (criteria.method === 'SSE') {
      if (request.protocol !== 'sse') {
        return false;
      }
    } else if (request.protocol === 'sse' || request.method !== criteria.method) {
      return false;
    }
  }
  if (criteria.marker != null && !colorsMatch(request.marker, criteria.marker)) {
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
  if (criteria.marker != null && !colorsMatch(document.marker, criteria.marker)) {
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

    const collectionMarkerMatch =
      criteria.marker != null && colorsMatch(collection.marker, criteria.marker);
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
      const folderMarkerMatch =
        criteria.marker != null && colorsMatch(folder.marker, criteria.marker);
      if (folderMarkerMatch) {
        folderIds.add(folder.id);
        hasVisibleDescendant = true;
      }
    }

    if (collectionMarkerMatch || hasVisibleDescendant) {
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
