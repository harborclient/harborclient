import { getFolderAncestors, getFolderPath } from '../folderTree';
import type { Collection, Environment, Folder, SavedRequest } from '../types';
import { createTextSearchIndex, searchTextIndex, type HarborSearchIndex } from './oramaIndex';
import { normalizeRequestTags } from '../requestTags';

/**
 * Sidebar entities passed from the renderer for indexing and filtering.
 */
export interface SidebarSearchInput {
  /**
   * Collections in sidebar display order.
   */
  collections: Collection[];

  /**
   * Folders grouped by collection id; omitted keys mean contents not loaded yet.
   */
  foldersByCollection: Record<number, Folder[]>;

  /**
   * Saved requests grouped by collection id; omitted keys mean contents not loaded yet.
   */
  requestsByCollection: Record<number, SavedRequest[]>;

  /**
   * Environments in sidebar display order.
   */
  environments: Environment[];
}

/**
 * Visibility sets used to filter the collections tree and environments list.
 */
export interface SidebarSearchFilter {
  /**
   * Collection rows to show in the sidebar tree.
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
   * Environment rows to show in the environments section.
   */
  environmentIds: ReadonlySet<number>;
}

/**
 * Sidebar entity kinds indexed for search.
 */
export type SidebarEntityKind = 'collection' | 'folder' | 'request' | 'environment';

/**
 * Indexed fields for sidebar entity search.
 */
export type SidebarSearchDocument = {
  id: string;
  kind: SidebarEntityKind;
  name: string;
  url: string;
  method: string;
  comment: string;
  tags: string;
  collectionId: number;
  folderId: number;
};

const SIDEBAR_SEARCH_SCHEMA = {
  id: 'string',
  kind: 'string',
  name: 'string',
  url: 'string',
  method: 'string',
  comment: 'string',
  tags: 'string',
  collectionId: 'number',
  folderId: 'number'
} as const;

const SIDEBAR_SEARCH_PROPERTIES = ['name', 'url', 'method', 'comment', 'tags'];

/** Sentinel folder id when a request is not nested in a folder. */
const NO_FOLDER_ID = -1;

/**
 * Builds a composite document id for one sidebar entity kind.
 *
 * @param kind - Entity category.
 * @param entityId - Numeric database id.
 */
export function sidebarDocumentId(kind: SidebarEntityKind, entityId: number): string {
  return `${kind}:${entityId}`;
}

/**
 * Parses a composite sidebar document id into kind and numeric id.
 *
 * @param documentId - Composite id stored in the search index.
 */
export function parseSidebarDocumentId(documentId: string): {
  kind: SidebarEntityKind;
  entityId: number;
} | null {
  const match = /^(collection|folder|request|environment):(\d+)$/.exec(documentId);
  if (!match) {
    return null;
  }
  return {
    kind: match[1] as SidebarEntityKind,
    entityId: Number(match[2])
  };
}

/**
 * Normalizes a nullable folder id for Orama indexing.
 *
 * @param folderId - Folder id from the database, or null/undefined when unset.
 */
function sidebarFolderIdForIndex(folderId: number | null | undefined): number {
  return folderId ?? NO_FOLDER_ID;
}

/**
 * Restores a nullable folder id from an indexed sidebar document.
 *
 * @param folderId - Folder id stored in the search index.
 */
function sidebarFolderIdFromIndex(folderId: number): number | null {
  return folderId >= 0 ? folderId : null;
}

/**
 * Merges folder rows from collection caches for indexing.
 *
 * When the same folder id appears in multiple buckets (stale cache), prefer the
 * copy whose `collection_id` matches the bucket key.
 *
 * @param input - Sidebar data currently available in the renderer store.
 */
function dedupeFoldersForSearch(input: SidebarSearchInput): Folder[] {
  const foldersById = new Map<number, Folder>();
  for (const collection of input.collections) {
    for (const folder of input.foldersByCollection[collection.id] ?? []) {
      const existing = foldersById.get(folder.id);
      if (existing == null || folder.collection_id === collection.id) {
        foldersById.set(folder.id, folder);
      }
    }
  }
  return [...foldersById.values()];
}

/**
 * Merges request rows from collection caches for indexing.
 *
 * When the same request id appears in multiple buckets (stale cache), prefer the
 * copy whose `collection_id` matches the bucket key.
 *
 * @param input - Sidebar data currently available in the renderer store.
 */
function dedupeRequestsForSearch(input: SidebarSearchInput): SavedRequest[] {
  const requestsById = new Map<number, SavedRequest>();
  for (const collection of input.collections) {
    for (const request of input.requestsByCollection[collection.id] ?? []) {
      const existing = requestsById.get(request.id);
      if (existing == null || request.collection_id === collection.id) {
        requestsById.set(request.id, request);
      }
    }
  }
  return [...requestsById.values()];
}

/**
 * Builds an Orama index over collections, folders, requests, and environments.
 *
 * @param input - Sidebar data currently available in the renderer store.
 * @returns Search index keyed by composite entity ids.
 */
export function buildSidebarSearchIndex(input: SidebarSearchInput): HarborSearchIndex {
  const documents: SidebarSearchDocument[] = [];

  for (const collection of input.collections) {
    documents.push({
      id: sidebarDocumentId('collection', collection.id),
      kind: 'collection',
      name: collection.name,
      url: '',
      method: '',
      comment: '',
      tags: '',
      collectionId: collection.id,
      folderId: NO_FOLDER_ID
    });
  }

  for (const environment of input.environments) {
    documents.push({
      id: sidebarDocumentId('environment', environment.id),
      kind: 'environment',
      name: environment.name,
      url: '',
      method: '',
      comment: '',
      tags: '',
      collectionId: 0,
      folderId: NO_FOLDER_ID
    });
  }

  for (const folder of dedupeFoldersForSearch(input)) {
    documents.push({
      id: sidebarDocumentId('folder', folder.id),
      kind: 'folder',
      name: folder.name,
      url: '',
      method: '',
      comment: '',
      tags: '',
      collectionId: folder.collection_id,
      folderId: folder.id
    });
  }

  for (const request of dedupeRequestsForSearch(input)) {
    const trimmedComment = request.comment.trim();
    const normalizedTags = normalizeRequestTags(request.tags ?? '');
    documents.push({
      id: sidebarDocumentId('request', request.id),
      kind: 'request',
      name: request.name,
      url: request.url,
      method: request.method,
      comment: trimmedComment,
      tags: normalizedTags,
      collectionId: request.collection_id,
      folderId: sidebarFolderIdForIndex(request.folder_id)
    });
  }

  return createTextSearchIndex(SIDEBAR_SEARCH_SCHEMA, documents);
}

/**
 * Computes hierarchical visibility sets from direct Orama hits.
 *
 * @param input - Sidebar data used to resolve parent/child relationships.
 * @param hits - Parsed direct search hits by entity kind.
 */
function buildSidebarSearchFilter(
  input: SidebarSearchInput,
  hits: {
    collections: Set<number>;
    folders: Set<number>;
    requests: Set<number>;
    environments: Set<number>;
  }
): SidebarSearchFilter {
  const collectionIds = new Set<number>();
  const folderIds = new Set<number>();
  const requestIds = new Set<number>();
  const environmentIds = new Set<number>(hits.environments);

  const folderById = new Map<number, Folder>();
  const requestById = new Map<number, SavedRequest>();

  for (const collection of input.collections) {
    for (const folder of input.foldersByCollection[collection.id] ?? []) {
      folderById.set(folder.id, folder);
    }
    for (const request of input.requestsByCollection[collection.id] ?? []) {
      requestById.set(request.id, request);
    }
  }

  /**
   * Reveals a folder and every ancestor needed to render its nested path.
   *
   * @param folderId - Folder at the bottom of the visible path.
   */
  const addFolderPath = (folderId: number): void => {
    folderIds.add(folderId);
    for (const ancestor of getFolderAncestors(folderId, [...folderById.values()])) {
      folderIds.add(ancestor.id);
    }
  };

  for (const requestId of hits.requests) {
    const request = requestById.get(requestId);
    if (request == null) {
      continue;
    }
    requestIds.add(request.id);
    collectionIds.add(request.collection_id);
    if (request.folder_id != null) {
      addFolderPath(request.folder_id);
    }
  }

  for (const folderId of hits.folders) {
    const folder = folderById.get(folderId);
    if (folder == null) {
      continue;
    }
    addFolderPath(folder.id);
    collectionIds.add(folder.collection_id);
    for (const request of input.requestsByCollection[folder.collection_id] ?? []) {
      if (request.folder_id === folder.id) {
        requestIds.add(request.id);
      }
    }
  }

  for (const collectionId of hits.collections) {
    collectionIds.add(collectionId);
    for (const folder of input.foldersByCollection[collectionId] ?? []) {
      folderIds.add(folder.id);
    }
    for (const request of input.requestsByCollection[collectionId] ?? []) {
      requestIds.add(request.id);
    }
  }

  return {
    collectionIds,
    folderIds,
    requestIds,
    environmentIds
  };
}

/**
 * Filters sidebar entities by a user query using the prebuilt search index.
 *
 * @param input - Sidebar data currently available in the renderer store.
 * @param index - Orama index built from the same sidebar rows.
 * @param query - Raw search text from the sidebar search field.
 * @returns Visibility sets for tree filtering, or null when the query is empty.
 */
export function searchSidebar(
  input: SidebarSearchInput,
  index: HarborSearchIndex,
  query: string
): SidebarSearchFilter | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const hits = {
    collections: new Set<number>(),
    folders: new Set<number>(),
    requests: new Set<number>(),
    environments: new Set<number>()
  };

  for (const result of searchTextIndex<SidebarSearchDocument>(index, trimmed, {
    properties: SIDEBAR_SEARCH_PROPERTIES,
    threshold: 0
  })) {
    const parsed = parseSidebarDocumentId(result.id);
    if (parsed == null) {
      continue;
    }
    switch (parsed.kind) {
      case 'collection':
        hits.collections.add(parsed.entityId);
        break;
      case 'folder':
        hits.folders.add(parsed.entityId);
        break;
      case 'request':
        hits.requests.add(parsed.entityId);
        break;
      case 'environment':
        hits.environments.add(parsed.entityId);
        break;
    }
  }

  return buildSidebarSearchFilter(input, hits);
}

/**
 * Returns direct sidebar entity hits with scores for unified global search.
 *
 * @param input - Sidebar data used to resolve subtitles.
 * @param index - Orama index built from the same sidebar rows.
 * @param query - Raw search text.
 */
export function searchSidebarEntities(
  input: SidebarSearchInput,
  index: HarborSearchIndex,
  query: string
): Array<{
  kind: SidebarEntityKind;
  entityId: number;
  score: number;
  name: string;
  method?: string;
  collectionId?: number;
  folderId?: number | null;
}> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  return searchTextIndex<SidebarSearchDocument>(index, trimmed, {
    properties: SIDEBAR_SEARCH_PROPERTIES,
    threshold: 0
  }).flatMap((result) => {
    const parsed = parseSidebarDocumentId(result.id);
    if (parsed == null) {
      return [];
    }
    const stored = result.document;
    const folderId = sidebarFolderIdFromIndex(stored.folderId);
    return [
      {
        kind: parsed.kind,
        entityId: parsed.entityId,
        score: result.score,
        name: stored.name,
        method: stored.method.length > 0 ? stored.method : undefined,
        collectionId: stored.collectionId > 0 ? stored.collectionId : undefined,
        folderId
      }
    ];
  });
}

/**
 * Collection and folder names for a saved request breadcrumb.
 */
export interface SidebarRequestBreadcrumb {
  /** Parent collection display name. */
  collectionName?: string;
  /**
   * Folder path from collection root to the request's folder when nested.
   * Nested folders are joined with `" / "` (for example `Auth / Users`).
   */
  folderName?: string;
}

/**
 * Active and archived halves of a sidebar search filter.
 */
export interface PartitionedSidebarSearchFilter {
  /**
   * Visibility sets for non-archived collections (and their folders/requests).
   */
  active: SidebarSearchFilter;

  /**
   * Visibility sets for archived collections (and their folders/requests).
   */
  archived: SidebarSearchFilter;
}

/**
 * Returns whether the collection with the given id is archived.
 *
 * @param input - Sidebar data for collection lookups.
 * @param collectionId - Numeric collection id to check.
 */
export function isArchivedCollection(
  input: SidebarSearchInput,
  collectionId: number | undefined
): boolean {
  if (collectionId == null) {
    return false;
  }
  const collection = input.collections.find((candidate) => candidate.id === collectionId);
  return Boolean(collection?.archived);
}

/**
 * Formats a collection display name with an archived prefix for search results.
 *
 * @param name - Raw collection name.
 */
export function formatArchivedCollectionLabel(name: string): string {
  return `Archived: ${name}`;
}

/**
 * Splits a sidebar search filter into active and archived partitions.
 *
 * Folder and request ids are retained only when they belong to a collection in
 * the matching partition. Environment ids stay on the active half only.
 *
 * @param input - Sidebar data used to resolve archived flags and ownership.
 * @param filter - Combined visibility sets from {@link searchSidebar}.
 */
export function partitionSidebarSearchFilter(
  input: SidebarSearchInput,
  filter: SidebarSearchFilter
): PartitionedSidebarSearchFilter {
  const archivedCollectionIds = new Set<number>();
  const activeCollectionIds = new Set<number>();

  for (const collectionId of filter.collectionIds) {
    if (isArchivedCollection(input, collectionId)) {
      archivedCollectionIds.add(collectionId);
    } else {
      activeCollectionIds.add(collectionId);
    }
  }

  const folderById = new Map<number, Folder>();
  const requestById = new Map<number, SavedRequest>();

  for (const collection of input.collections) {
    for (const folder of input.foldersByCollection[collection.id] ?? []) {
      folderById.set(folder.id, folder);
    }
    for (const request of input.requestsByCollection[collection.id] ?? []) {
      requestById.set(request.id, request);
    }
  }

  /**
   * Keeps folder ids whose parent collection is in `collectionIds`.
   *
   * @param collectionIds - Allowed parent collection ids.
   */
  const partitionFolderIds = (collectionIds: ReadonlySet<number>): Set<number> => {
    const next = new Set<number>();
    for (const folderId of filter.folderIds) {
      const folder = folderById.get(folderId);
      if (folder != null && collectionIds.has(folder.collection_id)) {
        next.add(folderId);
      }
    }
    return next;
  };

  /**
   * Keeps request ids whose parent collection is in `collectionIds`.
   *
   * @param collectionIds - Allowed parent collection ids.
   */
  const partitionRequestIds = (collectionIds: ReadonlySet<number>): Set<number> => {
    const next = new Set<number>();
    for (const requestId of filter.requestIds) {
      const request = requestById.get(requestId);
      if (request != null && collectionIds.has(request.collection_id)) {
        next.add(requestId);
      }
    }
    return next;
  };

  return {
    active: {
      collectionIds: activeCollectionIds,
      folderIds: partitionFolderIds(activeCollectionIds),
      requestIds: partitionRequestIds(activeCollectionIds),
      environmentIds: filter.environmentIds
    },
    archived: {
      collectionIds: archivedCollectionIds,
      folderIds: partitionFolderIds(archivedCollectionIds),
      requestIds: partitionRequestIds(archivedCollectionIds),
      environmentIds: new Set()
    }
  };
}

/**
 * Resolves collection and folder names for a saved request breadcrumb.
 * Prefixes the collection name with "Archived: " when the parent is archived.
 *
 * @param input - Sidebar data for name lookups.
 * @param collectionId - Numeric collection id for the request.
 * @param folderId - Numeric folder id when nested, otherwise null or undefined.
 */
export function sidebarRequestBreadcrumb(
  input: SidebarSearchInput,
  collectionId: number | undefined,
  folderId: number | null | undefined
): SidebarRequestBreadcrumb {
  if (collectionId == null) {
    return {};
  }

  const collection = input.collections.find((candidate) => candidate.id === collectionId);
  const folders = input.foldersByCollection[collectionId] ?? [];
  const folderPath = folderId != null ? getFolderPath(folderId, folders) : '';
  const folderName = folderPath.length > 0 ? folderPath : undefined;

  const rawName = collection?.name;
  const collectionName =
    rawName != null && collection?.archived ? formatArchivedCollectionLabel(rawName) : rawName;

  return {
    collectionName,
    folderName
  };
}

/**
 * Resolves a subtitle for a sidebar entity hit using loaded sidebar data.
 * Archived collection names are prefixed with "Archived: ".
 *
 * @param input - Sidebar data for name lookups.
 * @param hit - Parsed sidebar entity hit.
 */
export function sidebarEntitySubtitle(
  input: SidebarSearchInput,
  hit: {
    kind: SidebarEntityKind;
    collectionId?: number;
    folderId?: number | null;
  }
): string | undefined {
  if (hit.kind === 'folder' && hit.collectionId != null) {
    const collection = input.collections.find((candidate) => candidate.id === hit.collectionId);
    if (collection == null) {
      return undefined;
    }
    const collectionName = collection.archived
      ? formatArchivedCollectionLabel(collection.name)
      : collection.name;
    const folders = input.foldersByCollection[hit.collectionId] ?? [];
    const ancestorPath =
      hit.folderId != null
        ? getFolderAncestors(hit.folderId, folders)
            .reverse()
            .map((folder) => folder.name)
            .join(' / ')
        : '';
    return ancestorPath ? `${collectionName} / ${ancestorPath}` : collectionName;
  }
  if (hit.kind === 'request' && hit.collectionId != null) {
    const { collectionName, folderName } = sidebarRequestBreadcrumb(
      input,
      hit.collectionId,
      hit.folderId
    );
    if (collectionName != null && folderName != null) {
      return `${collectionName} / ${folderName}`;
    }
    return collectionName;
  }
  return undefined;
}
