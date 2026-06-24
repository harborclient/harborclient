import {
  buildFolderImportMaps,
  buildRequestUuidIndex,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportedFolderUuid,
  serializeImportedRequestFields
} from '#/main/storage/collectionImport';
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport
} from '#/main/storage/collectionData';
import type { TeamHubIdMap } from '#/main/storage/TeamHubIdMap';
import { trimRequiredName } from '#/main/storage/trimRequiredName';
import { resolveImportUuid } from '#/main/storage/uuid';
import type { IStorage } from '#/main/storage/IStorage';
import type { TeamHubClient } from '#/main/teamHub/TeamHubClient';
import type { CollectionRecord, FolderRecord, SavedRequestRecord } from '#/main/teamHub/types';
import { defaultAuth, normalizeAuth } from '#/shared/auth';
import type {
  AuthConfig,
  Collection,
  CollectionExport,
  Environment,
  Folder,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types';

/**
 * Maps a server collection record to the local {@link Collection} shape.
 *
 * @param record - Collection payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 */
function serverToCollection(record: CollectionRecord, localId: number): Collection {
  return {
    id: localId,
    uuid: record.id,
    name: record.name,
    variables: record.variables.map(normalizeVariable),
    headers: record.headers,
    auth: normalizeAuth(record.auth),
    pre_request_script: record.preRequestScript,
    post_request_script: record.postRequestScript,
    created_at: record.createdAt
  };
}

/**
 * Maps a server folder record to the local {@link Folder} shape.
 *
 * @param record - Folder payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 * @param localCollectionId - Mapped parent collection id.
 */
function serverToFolder(record: FolderRecord, localId: number, localCollectionId: number): Folder {
  return {
    id: localId,
    uuid: record.id,
    collection_id: localCollectionId,
    name: record.name,
    sort_order: record.sortOrder,
    created_at: record.createdAt
  };
}

/**
 * Maps a server saved request record to the local {@link SavedRequest} shape.
 *
 * @param record - Request payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 * @param localCollectionId - Mapped parent collection id.
 * @param localFolderId - Mapped parent folder id, or null at collection root.
 */
function serverToRequest(
  record: SavedRequestRecord,
  localId: number,
  localCollectionId: number,
  localFolderId: number | null
): SavedRequest {
  return {
    id: localId,
    uuid: record.id,
    collection_id: localCollectionId,
    name: record.name,
    method: record.method,
    url: record.url,
    headers: record.headers,
    params: record.params,
    auth: normalizeAuth(record.auth),
    body: record.body,
    body_type: record.bodyType,
    pre_request_script: record.preRequestScript,
    post_request_script: record.postRequestScript,
    comment: record.comment,
    folder_id: localFolderId,
    sort_order: record.sortOrder,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

/**
 * Builds the server request body used for create and update calls.
 *
 * @param input - Local save request payload with numeric ids already resolved.
 * @param folderServerId - Parent folder UUID, or null for collection root.
 */
function toServerRequestBody(
  input: SaveRequestInput,
  folderServerId: string | null
): {
  name: string;
  method: SaveRequestInput['method'];
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  auth: AuthConfig;
  body: string;
  bodyType: SaveRequestInput['body_type'];
  preRequestScript: string;
  postRequestScript: string;
  comment: string;
  folderId: string | null;
} {
  return {
    name: trimRequiredName(input.name, 'Request name'),
    method: input.method,
    url: input.url,
    headers: input.headers,
    params: input.params,
    auth: input.auth,
    body: input.body,
    bodyType: input.body_type,
    preRequestScript: input.pre_request_script ?? '',
    postRequestScript: input.post_request_script ?? '',
    comment: input.comment ?? '',
    folderId: folderServerId
  };
}

/**
 * {@link IStorage} adapter backed by HarborClient Server for a single team hub.
 */
export class TeamHubStorage implements IStorage {
  /**
   * @param client - Typed HTTP client for the hub's HarborClient Server instance.
   * @param idMap - Persistent UUID to numeric id map for this hub.
   */
  constructor(
    private readonly client: TeamHubClient,
    private readonly idMap: TeamHubIdMap
  ) {}

  /**
   * Verifies connectivity to HarborClient Server before the router mounts this backend.
   */
  async init(): Promise<void> {
    await this.client.checkHealth();
  }

  /**
   * Returns the server UUID for a mapped local collection id.
   *
   * @param localCollectionId - Provider-local collection id from the id map.
   */
  getServerCollectionId(localCollectionId: number): string | undefined {
    return this.idMap.toServerId('collection', localCollectionId);
  }

  /**
   * Drops the id map entry for a local collection without calling the server.
   *
   * Used when a collection was deleted remotely and the local registry is pruned.
   *
   * @param localCollectionId - Provider-local collection id from the id map.
   */
  forgetLocalCollection(localCollectionId: number): void {
    const serverId = this.getServerCollectionId(localCollectionId);
    if (serverId) {
      this.idMap.forget('collection', serverId);
    }
  }

  /**
   * Lists all collections from the server with ids translated to numeric form.
   */
  async listCollections(): Promise<Collection[]> {
    const records = await this.client.listCollections();
    return records.map((record) =>
      serverToCollection(record, this.idMap.toLocalId('collection', record.id))
    );
  }

  /**
   * Creates a collection on the server and registers its UUID in the id map.
   *
   * @param name - Display name for the collection.
   */
  async createCollection(name: string): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const record = await this.client.createCollection({ name: trimmedName });
    return serverToCollection(record, this.idMap.toLocalId('collection', record.id));
  }

  /**
   * Updates collection metadata on the server.
   */
  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig
  ): Promise<Collection> {
    const serverId = this.requireServerId('collection', id);
    const record = await this.client.updateCollection(serverId, {
      name: trimRequiredName(name, 'Collection name'),
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      auth
    });
    return serverToCollection(record, id);
  }

  /**
   * Deletes a collection on the server and forgets its id map entry.
   *
   * @param id - Provider-local collection id.
   */
  async deleteCollection(id: number): Promise<void> {
    const serverId = this.requireServerId('collection', id);
    await this.client.deleteCollection(serverId);
    this.idMap.forget('collection', serverId);
  }

  /**
   * Environments are stored in the local registry for team hub collections.
   */
  async listEnvironments(): Promise<Environment[]> {
    return [];
  }

  /**
   * Environments are stored in the local registry for team hub collections.
   */
  async createEnvironment(name: string): Promise<Environment> {
    void name;
    throw new Error('Environments are not stored on team hubs.');
  }

  /**
   * Environments are stored in the local registry for team hub collections.
   */
  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    void id;
    void name;
    void variables;
    throw new Error('Environments are not stored on team hubs.');
  }

  /**
   * Environments are stored in the local registry for team hub collections.
   */
  async deleteEnvironment(id: number): Promise<void> {
    void id;
    throw new Error('Environments are not stored on team hubs.');
  }

  /**
   * Lists saved requests in a collection with ids translated to numeric form.
   *
   * @param collectionId - Provider-local collection id.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const collectionServerId = this.requireServerId('collection', collectionId);
    const records = await this.client.listRequests(collectionServerId);
    return records.map((record) => this.mapRequestRecord(record, collectionId));
  }

  /**
   * Creates or updates a saved request on the server.
   *
   * @param input - Request fields with provider-local numeric ids.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const collectionServerId = this.requireServerId('collection', input.collection_id);
    const folderServerId =
      input.folder_id != null ? this.requireServerId('folder', input.folder_id) : null;

    const body = toServerRequestBody(input, folderServerId);

    if (input.id != null) {
      const requestServerId = this.requireServerId('request', input.id);
      const record = await this.client.updateRequest(requestServerId, {
        ...body,
        collectionId: collectionServerId
      });
      return this.mapRequestRecord(record, input.collection_id);
    }

    const record = await this.client.createRequest(collectionServerId, body);
    return this.mapRequestRecord(record, input.collection_id);
  }

  /**
   * Deletes a saved request on the server.
   *
   * @param id - Provider-local request id.
   */
  async deleteRequest(id: number): Promise<void> {
    const serverId = this.requireServerId('request', id);
    await this.client.deleteRequest(serverId);
    this.idMap.forget('request', serverId);
  }

  /**
   * Lists folders in a collection with ids translated to numeric form.
   *
   * @param collectionId - Provider-local collection id.
   */
  async listFolders(collectionId: number): Promise<Folder[]> {
    const collectionServerId = this.requireServerId('collection', collectionId);
    const records = await this.client.listFolders(collectionServerId);
    return records.map((record) =>
      serverToFolder(record, this.idMap.toLocalId('folder', record.id), collectionId)
    );
  }

  /**
   * Creates a folder on the server.
   *
   * @param collectionId - Provider-local collection id.
   * @param name - Display name for the folder.
   */
  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const collectionServerId = this.requireServerId('collection', collectionId);
    const record = await this.client.createFolder(collectionServerId, {
      name: trimRequiredName(name, 'Folder name')
    });
    return serverToFolder(record, this.idMap.toLocalId('folder', record.id), collectionId);
  }

  /**
   * Renames a folder on the server.
   *
   * @param id - Provider-local folder id.
   * @param name - New display name.
   */
  async renameFolder(id: number, name: string): Promise<Folder> {
    const serverId = this.requireServerId('folder', id);
    const record = await this.client.renameFolder(serverId, {
      name: trimRequiredName(name, 'Folder name')
    });
    const localCollectionId = this.idMap.toLocalId('collection', record.collectionId);
    return serverToFolder(record, id, localCollectionId);
  }

  /**
   * Deletes a folder on the server.
   *
   * @param id - Provider-local folder id.
   */
  async deleteFolder(id: number): Promise<void> {
    const serverId = this.requireServerId('folder', id);
    await this.client.deleteFolder(serverId);
    this.idMap.forget('folder', serverId);
  }

  /**
   * Reorders folders within a collection on the server.
   */
  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
    const collectionServerId = this.requireServerId('collection', collectionId);
    const orderedFolderServerIds = orderedFolderIds.map((folderId) =>
      this.requireServerId('folder', folderId)
    );
    await this.client.reorderFolders(collectionServerId, {
      orderedFolderIds: orderedFolderServerIds
    });
  }

  /**
   * Reorders requests within a folder or collection root on the server.
   */
  async reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void> {
    const collectionServerId = this.requireServerId('collection', collectionId);
    const folderServerId = folderId != null ? this.requireServerId('folder', folderId) : null;
    const orderedRequestServerIds = orderedRequestIds.map((requestId) =>
      this.requireServerId('request', requestId)
    );
    await this.client.reorderRequests(collectionServerId, {
      folderId: folderServerId,
      orderedRequestIds: orderedRequestServerIds
    });
  }

  /**
   * Moves a request to another folder or collection root on the server.
   */
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const requestServerId = this.requireServerId('request', requestId);
    const folderServerId = folderId != null ? this.requireServerId('folder', folderId) : null;
    await this.client.moveRequest(requestServerId, {
      folderId: folderServerId,
      index
    });
  }

  /**
   * Builds a portable export payload from server-backed collection data.
   *
   * @param id - Provider-local collection id.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const collections = await this.listCollections();
    const collection = collections.find((item) => item.id === id);
    if (!collection) {
      throw new Error('Collection not found');
    }

    const folderRows = await this.listFolders(id);
    const folders = folderRows.map(({ uuid, name, sort_order }) => ({
      uuid,
      name,
      sort_order
    }));
    const folderNameById = new Map(folderRows.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRows.map((folder) => [folder.id, folder.uuid]));

    const requests = (await this.listRequests(id)).map(
      ({
        uuid,
        name,
        method,
        url,
        headers,
        params,
        auth,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        comment,
        sort_order,
        folder_id
      }) => ({
        uuid,
        name,
        method,
        url,
        headers,
        params,
        auth,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        comment,
        sort_order,
        folder_name: folder_id != null ? (folderNameById.get(folder_id) ?? null) : null,
        folder_uuid: folder_id != null ? (folderUuidById.get(folder_id) ?? null) : null
      })
    );

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: collection.uuid,
      name: collection.name,
      variables: maskVariablesForExport(collection.variables),
      headers: collection.headers,
      auth: collection.auth,
      pre_request_script: collection.pre_request_script,
      post_request_script: collection.post_request_script,
      folders,
      requests
    };
  }

  /**
   * Imports a collection export by creating entities on the server.
   *
   * @param data - Parsed collection export payload.
   */
  async importCollectionData(data: unknown): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const created = await this.createCollection(exportData.name);
    const updated = await this.updateCollection(
      created.id,
      exportData.name,
      exportData.variables,
      exportData.headers,
      exportData.pre_request_script,
      exportData.post_request_script,
      exportData.auth ?? defaultAuth()
    );

    const folderMaps: ReturnType<typeof buildFolderImportMaps> = {
      folderIdByUuid: new Map(),
      folderIdByName: new Map(),
      folderUuidById: new Map()
    };
    const orderedFolderIds: number[] = [];

    for (const folder of exportData.folders ?? []) {
      const createdFolder = await this.createFolder(updated.id, folder.name);
      const importUuid = resolveImportedFolderUuid(folder);
      registerImportedFolderInMaps(folderMaps, createdFolder.id, folder.name, importUuid);
      orderedFolderIds.push(createdFolder.id);
    }

    if (orderedFolderIds.length > 0) {
      await this.reorderFolders(updated.id, orderedFolderIds);
    }

    for (const request of exportData.requests) {
      const folderId = resolveImportFolderId(
        request.folder_uuid,
        request.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      await this.saveRequest({
        collection_id: updated.id,
        folder_id: folderId,
        uuid: resolveImportUuid(request.uuid),
        name: request.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        auth: request.auth ?? defaultAuth(),
        body: request.body,
        body_type: request.body_type,
        pre_request_script: request.pre_request_script,
        post_request_script: request.post_request_script,
        comment: request.comment
      });
    }

    return updated;
  }

  /**
   * Looks up a collection by server UUID within this team hub store.
   *
   * @param uuid - Stable collection identifier (server id).
   * @returns The collection when found, otherwise null.
   */
  async findCollectionByUuid(uuid: string): Promise<Collection | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const localId = this.idMap.findLocalId('collection', trimmed);
    if (localId == null) {
      return null;
    }

    const collections = await this.listCollections();
    return collections.find((item) => item.id === localId) ?? null;
  }

  /**
   * Looks up a request by server UUID within a collection in this team hub store.
   *
   * @param collectionId - Provider-local collection id.
   * @param uuid - Stable request identifier (server id).
   * @returns The request when found, otherwise null.
   */
  async findRequestByUuid(collectionId: number, uuid: string): Promise<SavedRequest | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const requests = await this.listRequests(collectionId);
    return requests.find((request) => request.uuid === trimmed) ?? null;
  }

  /**
   * Updates an existing collection and upserts folders and requests from import data.
   *
   * @param id - Provider-local collection id to update.
   * @param data - Validated collection export payload.
   * @returns The updated collection.
   */
  async updateCollectionFromImport(id: number, data: CollectionExport): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const updated = await this.updateCollection(
      id,
      exportData.name,
      exportData.variables,
      exportData.headers,
      exportData.pre_request_script,
      exportData.post_request_script,
      exportData.auth ?? defaultAuth()
    );

    const existingFolders = await this.listFolders(id);
    const folderMaps = buildFolderImportMaps(existingFolders);
    const orderedFolderIds: number[] = [];

    for (const folder of exportData.folders ?? []) {
      const plan = planImportedFolderUpsert(folder, folderMaps);
      if (plan.action === 'update') {
        const existingFolder = existingFolders.find((item) => item.id === plan.existingId);
        if (existingFolder != null && existingFolder.name !== plan.name) {
          await this.renameFolder(plan.existingId, plan.name);
        }
        registerImportedFolderInMaps(folderMaps, plan.existingId, plan.name, plan.uuid);
        orderedFolderIds.push(plan.existingId);
        continue;
      }

      const createdFolder = await this.createFolder(id, plan.name);
      registerImportedFolderInMaps(folderMaps, createdFolder.id, plan.name, plan.uuid);
      orderedFolderIds.push(createdFolder.id);
    }

    if (orderedFolderIds.length > 0) {
      await this.reorderFolders(id, orderedFolderIds);
    }

    const existingRequests = await this.listRequests(id);
    const requestUuidIndex = buildRequestUuidIndex(existingRequests);

    for (const request of exportData.requests) {
      const folderId = resolveImportFolderId(
        request.folder_uuid,
        request.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedRequestFields(request);
      const existingRequestId = fields.uuid ? requestUuidIndex.get(fields.uuid) : undefined;

      await this.saveRequest({
        ...(existingRequestId != null ? { id: existingRequestId } : {}),
        collection_id: id,
        folder_id: folderId,
        uuid: fields.uuid,
        name: fields.name,
        method: fields.method,
        url: fields.url,
        headers: request.headers,
        params: request.params,
        auth: request.auth ?? defaultAuth(),
        body: fields.body,
        body_type: fields.body_type,
        pre_request_script: fields.pre_request_script,
        post_request_script: fields.post_request_script,
        comment: fields.comment
      });
    }

    return updated;
  }

  /**
   * Settings are stored in the local registry for team hub collections.
   */
  async getSetting(): Promise<string | undefined> {
    return undefined;
  }

  /**
   * Settings are stored in the local registry for team hub collections.
   */
  async setSetting(): Promise<void> {
    // no-op
  }

  /**
   * Team hubs are not git-backed working trees.
   */
  async getSourceControlStatus(): Promise<null> {
    return null;
  }

  /**
   * Closes the id map database; the HTTP client has no persistent connection.
   */
  async close(): Promise<void> {
    this.idMap.close();
  }

  /**
   * Maps a server request record using the id map for numeric ids.
   *
   * @param record - Request payload from HarborClient Server.
   * @param localCollectionId - Provider-local parent collection id.
   */
  private mapRequestRecord(record: SavedRequestRecord, localCollectionId: number): SavedRequest {
    const localFolderId =
      record.folderId != null ? this.idMap.toLocalId('folder', record.folderId) : null;
    return serverToRequest(
      record,
      this.idMap.toLocalId('request', record.id),
      localCollectionId,
      localFolderId
    );
  }

  /**
   * Resolves a provider-local id to a server UUID or throws when unknown.
   *
   * @param entityType - Entity kind to resolve.
   * @param localId - Provider-local numeric id.
   */
  private requireServerId(
    entityType: 'collection' | 'folder' | 'request',
    localId: number
  ): string {
    const serverId = this.idMap.toServerId(entityType, localId);
    if (!serverId) {
      throw new Error(`${entityType} not found: ${localId}`);
    }
    return serverId;
  }
}
