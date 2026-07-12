import type { SaveRunResultInput } from '#/shared/collectionRunner';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import type {
  CollectionDocument,
  CreateTabGroupInput,
  Environment,
  Folder,
  RequestHistoryEntry,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  TabGroup
} from '#/shared/types';
import type { InsertTrashItemInput, TrashEntityType, TrashItem } from '#/shared/types/trash';

/**
 * Folder trash payload containing the folder and all direct child items.
 */
interface FolderTrashPayload {
  /**
   * Folder metadata at delete time.
   */
  folder: Folder;

  /**
   * Requests that lived directly inside the folder.
   */
  requests: SavedRequest[];

  /**
   * Markdown documents that lived directly inside the folder.
   */
  documents: CollectionDocument[];
}

/**
 * Collection trash payload with export data and registry metadata.
 */
interface CollectionTrashPayload {
  /**
   * Portable collection export used to recreate the collection.
   */
  exportData: unknown;

  /**
   * Registry display name at delete time.
   */
  registryName: string;
}

/**
 * Maps a saved request to create/update input for restore.
 *
 * @param request - Saved request snapshot.
 * @param collectionId - Destination global collection id.
 * @param folderId - Destination folder id, or null for collection root.
 * @returns Save input for the storage layer.
 */
function savedRequestToSaveInput(
  request: SavedRequest,
  collectionId: number,
  folderId: number | null
): SaveRequestInput {
  return {
    uuid: request.uuid,
    collection_id: collectionId,
    name: request.name,
    method: request.method,
    url: request.url,
    headers: request.headers,
    params: request.params,
    auth: request.auth,
    body: request.body,
    body_type: request.body_type,
    pre_request_script: request.pre_request_script,
    post_request_script: request.post_request_script,
    pre_request_scripts: request.pre_request_scripts,
    post_request_scripts: request.post_request_scripts,
    comment: request.comment,
    tags: request.tags,
    folder_id: folderId
  };
}

/**
 * Maps a collection document to create/update input for restore.
 *
 * @param document - Document snapshot.
 * @param collectionId - Destination global collection id.
 * @param folderId - Destination folder id, or null for collection root.
 * @returns Save input for the storage layer.
 */
function documentToSaveInput(
  document: CollectionDocument,
  collectionId: number,
  folderId: number | null
): SaveDocumentInput {
  return {
    uuid: document.uuid,
    collection_id: collectionId,
    name: document.name,
    content: document.content,
    folder_id: folderId,
    sort_order: document.sort_order
  };
}

/**
 * Moves sidebar entities into the registry trash table and restores them on demand.
 */
export class TrashService {
  /**
   * @param storage - Routed storage facade used for provider-backed entities.
   * @param database - Local registry database that stores trash snapshots.
   */
  constructor(
    private readonly storage: IStorage,
    private readonly database: LocalDatabase
  ) {}

  /**
   * Returns all trash snapshot rows for the sidebar.
   */
  listTrashItems(): TrashItem[] {
    return this.database.listTrashItems();
  }

  /**
   * Permanently deletes one trash snapshot row.
   *
   * @param id - Trash row id.
   */
  permanentlyDeleteTrashItem(id: number): void {
    this.database.deleteTrashItem(id);
  }

  /**
   * Permanently deletes every trash snapshot row.
   */
  emptyTrash(): void {
    this.database.clearTrash();
  }

  /**
   * Recreates an entity from its trash snapshot and removes the trash row.
   *
   * @param id - Trash row id.
   * @returns Restored entity type for targeted store refresh.
   */
  async restoreTrashItem(id: number): Promise<TrashEntityType> {
    const item = this.database.getTrashItem(id);
    if (!item) {
      throw new Error('Trash item not found');
    }

    switch (item.entityType) {
      case 'collection':
        await this.restoreCollection(item);
        break;
      case 'folder':
        await this.restoreFolder(item);
        break;
      case 'request':
        await this.restoreRequest(item);
        break;
      case 'document':
        await this.restoreDocument(item);
        break;
      case 'runResult':
        await this.restoreRunResult(item);
        break;
      case 'history':
        await this.restoreHistory(item);
        break;
      case 'environment':
        await this.restoreEnvironment(item);
        break;
      case 'tabGroup':
        await this.restoreTabGroup(item);
        break;
      default:
        throw new Error(`Unsupported trash entity type: ${String(item.entityType)}`);
    }

    this.database.deleteTrashItem(id);
    return item.entityType;
  }

  /**
   * Snapshots a collection and deletes it when not detached from a team hub sidebar.
   *
   * @param id - Global collection registry id.
   */
  async moveCollectionToTrash(id: number): Promise<void> {
    const router = this.requireRouter();
    const entry = this.database.getRegistryEntry(id);
    if (!entry) {
      throw new Error(`Collection ${id} not found`);
    }

    const payload: CollectionTrashPayload = {
      exportData: await router.exportCollectionData(id),
      registryName: entry.name
    };

    const mode = await router.deleteCollectionWithMode(id);
    if (mode === 'detached') {
      return;
    }

    this.database.insertTrashItem({
      entityType: 'collection',
      label: entry.name,
      connectionId: entry.connectionId,
      originalIds: {
        registryId: id,
        connectionId: entry.connectionId,
        providerCollectionId: entry.providerCollectionId
      },
      payload
    });
  }

  /**
   * Snapshots a folder subtree and deletes the folder.
   *
   * @param id - Global folder id.
   */
  async moveFolderToTrash(id: number): Promise<void> {
    const router = this.requireRouter();
    const located = await this.findFolderByGlobalId(router, id);
    if (!located) {
      throw new Error(`Folder ${id} not found`);
    }

    const { folder, collectionId, connectionId } = located;
    const requests = (await router.listRequests(collectionId)).filter(
      (request) => request.folder_id === id
    );
    const documents = (await router.listDocuments(collectionId)).filter(
      (document) => document.folder_id === id
    );

    const payload: FolderTrashPayload = { folder, requests, documents };
    await router.deleteFolder(id);

    this.database.insertTrashItem({
      entityType: 'folder',
      label: folder.name,
      connectionId,
      originalIds: {
        folderId: id,
        collectionId,
        connectionId
      },
      payload
    });
  }

  /**
   * Snapshots a request and deletes it.
   *
   * @param id - Global request id.
   */
  async moveRequestToTrash(id: number): Promise<void> {
    const router = this.requireRouter();
    const located = await this.findRequestByGlobalId(router, id);
    if (!located) {
      throw new Error(`Request ${id} not found`);
    }

    const { request, collectionId, connectionId } = located;
    await router.deleteRequest(id);

    this.database.insertTrashItem({
      entityType: 'request',
      label: request.name,
      connectionId,
      originalIds: {
        requestId: id,
        collectionId,
        folderId: request.folder_id,
        connectionId
      },
      payload: { request }
    });
  }

  /**
   * Snapshots a markdown document and deletes it.
   *
   * @param id - Global document id.
   */
  async moveDocumentToTrash(id: number): Promise<void> {
    const router = this.requireRouter();
    const located = await this.findDocumentByGlobalId(router, id);
    if (!located) {
      throw new Error(`Document ${id} not found`);
    }

    const { document, collectionId, connectionId } = located;
    await router.deleteDocument(id);

    this.database.insertTrashItem({
      entityType: 'document',
      label: document.name,
      connectionId,
      originalIds: {
        documentId: id,
        collectionId,
        folderId: document.folder_id,
        connectionId
      },
      payload: { document }
    });
  }

  /**
   * Snapshots a saved run result and deletes it.
   *
   * @param id - Global run result id.
   */
  async moveRunResultToTrash(id: number): Promise<void> {
    const router = this.requireRouter();
    const runResult = await router.getRunResult(id);
    if (!runResult) {
      throw new Error(`Run result ${id} not found`);
    }

    await router.deleteRunResult(id);

    this.database.insertTrashItem({
      entityType: 'runResult',
      label: runResult.label,
      connectionId: runResult.connectionId,
      originalIds: {
        runResultId: id,
        connectionId: runResult.connectionId
      },
      payload: {
        label: runResult.label,
        input: {
          label: runResult.label,
          payload: runResult.payload
        } satisfies SaveRunResultInput
      }
    });
  }

  /**
   * Snapshots a request history entry and deletes it.
   *
   * @param id - History entry id.
   */
  moveHistoryToTrash(id: number): void {
    const entry = this.database.getRequestHistoryEntry(id);
    if (!entry) {
      throw new Error(`History entry ${id} not found`);
    }

    this.database.deleteRequestHistory(id);

    this.database.insertTrashItem({
      entityType: 'history',
      label: entry.name?.trim() || `${entry.method} ${entry.url}`,
      originalIds: { historyId: id },
      payload: { entry }
    });
  }

  /**
   * Snapshots an environment and deletes it.
   *
   * @param id - Environment id.
   */
  async moveEnvironmentToTrash(id: number): Promise<void> {
    const environment = this.database.listEnvironments().find((item) => item.id === id);
    if (!environment) {
      throw new Error(`Environment ${id} not found`);
    }

    this.database.deleteEnvironment(id);

    this.database.insertTrashItem({
      entityType: 'environment',
      label: environment.name,
      originalIds: { environmentId: id },
      payload: { environment }
    });
  }

  /**
   * Snapshots a tab group and deletes it.
   *
   * @param id - Tab group id.
   */
  moveTabGroupToTrash(id: number): void {
    const tabGroup = this.database.listTabGroups().find((group) => group.id === id);
    if (!tabGroup) {
      throw new Error(`Tab group ${id} not found`);
    }

    this.database.deleteTabGroup(id);

    this.database.insertTrashItem({
      entityType: 'tabGroup',
      label: tabGroup.name,
      originalIds: { tabGroupId: id },
      payload: { tabGroup }
    });
  }

  /**
   * Restores a collection from export data on its original connection.
   *
   * @param item - Trash snapshot row.
   */
  private async restoreCollection(item: TrashItem): Promise<void> {
    const router = this.requireRouter();
    const payload = item.payload as CollectionTrashPayload;
    const connectionId =
      item.connectionId ??
      (typeof item.originalIds.connectionId === 'string' ? item.originalIds.connectionId : null);

    if (!connectionId) {
      throw new Error('Trash item is missing a storage connection id');
    }

    await router.importCollectionDataToConnection(
      connectionId,
      payload.exportData,
      payload.registryName
    );
  }

  /**
   * Restores a folder and its direct children into the original collection.
   *
   * @param item - Trash snapshot row.
   */
  private async restoreFolder(item: TrashItem): Promise<void> {
    const router = this.requireRouter();
    const payload = item.payload as FolderTrashPayload;
    const collectionId = this.readNumber(item.originalIds.collectionId);
    if (collectionId == null || !this.collectionExists(collectionId)) {
      throw new Error('Original collection no longer exists');
    }

    const created = await router.createFolder(collectionId, payload.folder.name);
    await router.updateFolder(
      created.id,
      payload.folder.name,
      payload.folder.variables,
      payload.folder.headers,
      payload.folder.pre_request_script,
      payload.folder.post_request_script,
      payload.folder.auth,
      payload.folder.pre_request_scripts,
      payload.folder.post_request_scripts
    );

    for (const request of payload.requests) {
      await router.saveRequest(savedRequestToSaveInput(request, collectionId, created.id));
    }

    for (const document of payload.documents) {
      await router.saveDocument(documentToSaveInput(document, collectionId, created.id));
    }
  }

  /**
   * Restores a request into its original collection, falling back to collection root.
   *
   * @param item - Trash snapshot row.
   */
  private async restoreRequest(item: TrashItem): Promise<void> {
    const router = this.requireRouter();
    const payload = item.payload as { request: SavedRequest };
    const collectionId = this.readNumber(item.originalIds.collectionId);
    if (collectionId == null || !this.collectionExists(collectionId)) {
      throw new Error('Original collection no longer exists');
    }

    const folderId = await this.resolveRestoreFolderId(
      router,
      collectionId,
      this.readNumber(item.originalIds.folderId)
    );

    await router.saveRequest(savedRequestToSaveInput(payload.request, collectionId, folderId));
  }

  /**
   * Restores a markdown document into its original collection, falling back to root.
   *
   * @param item - Trash snapshot row.
   */
  private async restoreDocument(item: TrashItem): Promise<void> {
    const router = this.requireRouter();
    const payload = item.payload as { document: CollectionDocument };
    const collectionId = this.readNumber(item.originalIds.collectionId);
    if (collectionId == null || !this.collectionExists(collectionId)) {
      throw new Error('Original collection no longer exists');
    }

    const folderId = await this.resolveRestoreFolderId(
      router,
      collectionId,
      this.readNumber(item.originalIds.folderId)
    );

    await router.saveDocument(documentToSaveInput(payload.document, collectionId, folderId));
  }

  /**
   * Restores a saved run result snapshot to its original connection.
   *
   * @param item - Trash snapshot row.
   */
  private async restoreRunResult(item: TrashItem): Promise<void> {
    const router = this.requireRouter();
    const payload = item.payload as { input: SaveRunResultInput };
    const connectionId =
      item.connectionId ??
      (typeof item.originalIds.connectionId === 'string' ? item.originalIds.connectionId : null);

    if (!connectionId) {
      throw new Error('Trash item is missing a storage connection id');
    }

    await router.saveRunResult(connectionId, payload.input);
  }

  /**
   * Restores a request history entry into the registry table.
   *
   * @param item - Trash snapshot row.
   */
  private restoreHistory(item: TrashItem): void {
    const payload = item.payload as { entry: RequestHistoryEntry };
    this.database.addRequestHistory(payload.entry);
  }

  /**
   * Restores an environment with its saved variables.
   *
   * @param item - Trash snapshot row.
   */
  private async restoreEnvironment(item: TrashItem): Promise<void> {
    const payload = item.payload as { environment: Environment };
    const created = this.database.createEnvironment(
      payload.environment.name,
      payload.environment.uuid
    );
    this.database.updateEnvironment(
      created.id,
      payload.environment.name,
      payload.environment.variables
    );
  }

  /**
   * Restores a tab group and its member requests.
   *
   * @param item - Trash snapshot row.
   */
  private restoreTabGroup(item: TrashItem): void {
    const payload = item.payload as { tabGroup: TabGroup };
    const input: CreateTabGroupInput = {
      name: payload.tabGroup.name,
      requests: payload.tabGroup.requests.map((request) => ({ ...request }))
    };
    this.database.createTabGroup(input);
  }

  /**
   * Returns the routed storage instance or throws when trash is unavailable.
   */
  private requireRouter(): RoutingStorage {
    if (!(this.storage instanceof RoutingStorage)) {
      throw new Error('Trash restore requires routed storage');
    }
    return this.storage;
  }

  /**
   * Returns whether a global collection id still exists in the registry.
   *
   * @param collectionId - Global collection id.
   */
  private collectionExists(collectionId: number): boolean {
    return this.database.getRegistryEntry(collectionId) != null;
  }

  /**
   * Resolves a restore folder id, falling back to collection root when missing.
   *
   * @param router - Routed storage facade.
   * @param collectionId - Destination collection id.
   * @param folderId - Original folder id, if any.
   */
  private async resolveRestoreFolderId(
    router: RoutingStorage,
    collectionId: number,
    folderId: number | null | undefined
  ): Promise<number | null> {
    if (folderId == null) {
      return null;
    }

    const folders = await router.listFolders(collectionId);
    return folders.some((folder) => folder.id === folderId) ? folderId : null;
  }

  /**
   * Reads a numeric original id from trash metadata.
   *
   * @param value - Stored original id value.
   */
  private readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  }

  /**
   * Finds a folder by global id across registry collections on the same backend slot.
   *
   * @param router - Routed storage facade.
   * @param folderId - Global folder id.
   */
  private async findFolderByGlobalId(
    router: RoutingStorage,
    folderId: number
  ): Promise<{ folder: Folder; collectionId: number; connectionId: string } | null> {
    const collections = await router.listCollections();
    for (const collection of collections) {
      const folders = await router.listFolders(collection.id);
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) {
        continue;
      }

      return {
        folder,
        collectionId: collection.id,
        connectionId: collection.connectionId ?? entryConnectionId(collection)
      };
    }

    return null;
  }

  /**
   * Finds a request by global id across all registered collections.
   *
   * @param router - Routed storage facade.
   * @param requestId - Global request id.
   */
  private async findRequestByGlobalId(
    router: RoutingStorage,
    requestId: number
  ): Promise<{ request: SavedRequest; collectionId: number; connectionId: string } | null> {
    const collections = await router.listCollections();
    for (const collection of collections) {
      const requests = await router.listRequests(collection.id);
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        continue;
      }

      return {
        request,
        collectionId: collection.id,
        connectionId: collection.connectionId ?? entryConnectionId(collection)
      };
    }

    return null;
  }

  /**
   * Finds a document by global id across all registered collections.
   *
   * @param router - Routed storage facade.
   * @param documentId - Global document id.
   */
  private async findDocumentByGlobalId(
    router: RoutingStorage,
    documentId: number
  ): Promise<{ document: CollectionDocument; collectionId: number; connectionId: string } | null> {
    const collections = await router.listCollections();
    for (const collection of collections) {
      const documents = await router.listDocuments(collection.id);
      const document = documents.find((item) => item.id === documentId);
      if (!document) {
        continue;
      }

      return {
        document,
        collectionId: collection.id,
        connectionId: collection.connectionId ?? entryConnectionId(collection)
      };
    }

    return null;
  }
}

/**
 * Returns the storage connection id for a collection row.
 *
 * @param collection - Collection metadata from the registry.
 */
function entryConnectionId(collection: { connectionId?: string; id: number }): string {
  if (collection.connectionId) {
    return collection.connectionId;
  }

  throw new Error(`Collection ${collection.id} is missing a storage connection id`);
}

/**
 * Inserts a trash snapshot row through the registry database.
 *
 * Exported for tests that exercise trash table persistence directly.
 *
 * @param database - Local registry database.
 * @param input - Trash snapshot metadata and payload.
 */
export function insertTrashItemForTesting(
  database: LocalDatabase,
  input: InsertTrashItemInput
): TrashItem {
  return database.insertTrashItem(input);
}
