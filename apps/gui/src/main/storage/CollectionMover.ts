import type { MountedBackend, RoutingInternals } from './routingInternals';
import type { Collection, CollectionDocument, Folder, SavedRequest } from '#/shared/types';

const COLLECTION_MOVE_PENDING_KEY = 'collection_move_pending';

interface PendingMoveCleanup {
  sourceConnectionId: string;
  sourceProviderCollectionId: number;
}

type PendingMoveCleanupMap = Record<string, PendingMoveCleanup>;

/**
 * Orchestrates collection moves between database providers and recovers
 * interrupted moves on startup.
 */
export class MoveCoordinator {
  private readonly internals: RoutingInternals;

  /**
   * @param internals - Shared routing context from RoutingStorage.
   */
  constructor(internals: RoutingInternals) {
    this.internals = internals;
  }

  /**
   * Moves a collection's data to another provider, keeping its global id stable.
   *
   * @param globalCollectionId - Registry (global) collection id.
   * @param targetConnectionId - Connection id of the destination provider.
   * @returns The collection with updated connection metadata.
   */
  async moveCollection(
    globalCollectionId: number,
    targetConnectionId: string
  ): Promise<Collection> {
    const entry = this.internals.requireEntry(globalCollectionId);

    if (entry.connectionId === targetConnectionId) {
      const sourceBackend = this.internals.getBackend(entry.connectionId);
      const record = sourceBackend
        ? (await sourceBackend.db.listCollections()).find(
            (item) => item.id === entry.providerCollectionId
          )
        : undefined;
      return this.internals.buildCollection(entry, record);
    }

    const sourceBackend = this.internals.requireBackendByConnectionId(entry.connectionId);
    const targetBackend = this.internals.requireBackendByConnectionId(targetConnectionId);

    const sourceCollections = await sourceBackend.db.listCollections();
    const record = sourceCollections.find((item) => item.id === entry.providerCollectionId);
    if (!record) {
      throw new Error(`Collection not found: ${globalCollectionId}`);
    }

    const sourceConnectionId = entry.connectionId;
    const sourceProviderCollectionId = entry.providerCollectionId;

    const requests = await sourceBackend.db.listRequests(sourceProviderCollectionId);
    const folders = await sourceBackend.db.listFolders(sourceProviderCollectionId);
    const documents = await sourceBackend.db.listDocuments(sourceProviderCollectionId);

    let targetProviderCollectionId: number | undefined;

    try {
      const created = await targetBackend.db.createCollection(record.name);
      const updated = await targetBackend.db.updateCollection(
        created.id,
        record.name,
        record.variables,
        record.headers,
        record.pre_request_script,
        record.post_request_script,
        record.auth
      );
      targetProviderCollectionId = updated.id;

      await copyCollectionContents(targetBackend, updated.id, folders, requests, documents);

      const updatedEntry = this.internals.database.updateRegistryEntry(globalCollectionId, {
        name: record.name,
        connectionId: targetConnectionId,
        providerCollectionId: updated.id
      });

      const leaveSourceIntact = sourceBackend.connectionType === 'team-hub';

      if (!leaveSourceIntact) {
        this.writePendingMoveCleanup(
          globalCollectionId,
          sourceConnectionId,
          sourceProviderCollectionId
        );
      }

      try {
        if (leaveSourceIntact) {
          const serverCollectionId = this.internals.resolveCollectionServerId(
            sourceConnectionId,
            sourceProviderCollectionId
          );
          if (serverCollectionId) {
            this.internals.addDetachedTeamHubCollection(sourceConnectionId, serverCollectionId);
          }
        } else {
          await sourceBackend.db.deleteCollection(sourceProviderCollectionId);
          this.clearPendingMoveCleanup(globalCollectionId);
        }
      } catch (err) {
        console.warn(
          leaveSourceIntact
            ? `Collection moved but failed to detach from team hub (global id ${globalCollectionId}):`
            : `Collection moved but source cleanup failed; will retry on next launch (global id ${globalCollectionId}):`,
          err
        );
      }

      return this.internals.buildCollection(updatedEntry, updated);
    } catch (err) {
      if (targetProviderCollectionId != null) {
        await this.cleanupPartialMoveTarget(
          targetBackend,
          targetProviderCollectionId,
          globalCollectionId,
          sourceConnectionId,
          sourceProviderCollectionId
        );
      }
      throw err;
    }
  }

  /**
   * Deep-copies a collection into a new collection on the same backend.
   *
   * @param globalCollectionId - Registry (global) collection id to duplicate.
   * @returns The newly created collection with a new global id.
   */
  async duplicateCollection(globalCollectionId: number): Promise<Collection> {
    const entry = this.internals.requireEntry(globalCollectionId);
    const backend = this.internals.requireBackendByConnectionId(entry.connectionId);

    const sourceCollections = await backend.db.listCollections();
    const record = sourceCollections.find((item) => item.id === entry.providerCollectionId);
    if (!record) {
      throw new Error(`Collection not found: ${globalCollectionId}`);
    }

    const folders = await backend.db.listFolders(entry.providerCollectionId);
    const requests = await backend.db.listRequests(entry.providerCollectionId);
    const documents = await backend.db.listDocuments(entry.providerCollectionId);

    const created = await backend.db.createCollection(`${record.name} (copy)`);
    const updated = await backend.db.updateCollection(
      created.id,
      `${record.name} (copy)`,
      record.variables,
      record.headers,
      record.pre_request_script,
      record.post_request_script,
      record.auth
    );

    await copyCollectionContents(backend, updated.id, folders, requests, documents);

    const newEntry = this.internals.database.addRegistryEntry({
      name: updated.name,
      connectionId: entry.connectionId,
      providerCollectionId: updated.id,
      collectionUuid: updated.uuid
    });

    return this.internals.buildCollection(newEntry, updated);
  }

  /**
   * Deletes stale source copies left behind by interrupted collection moves.
   */
  async recoverPendingMoveCleanups(): Promise<void> {
    const pending = this.readPendingMoveCleanups();

    for (const [globalIdStr, cleanup] of Object.entries(pending)) {
      const globalId = Number(globalIdStr);

      try {
        const entry = this.internals.database.getRegistryEntry(globalId);
        if (!entry) {
          this.clearPendingMoveCleanup(globalId);
          continue;
        }

        if (
          entry.connectionId === cleanup.sourceConnectionId &&
          entry.providerCollectionId === cleanup.sourceProviderCollectionId
        ) {
          this.clearPendingMoveCleanup(globalId);
          continue;
        }

        const sourceBackend = this.internals.getBackend(cleanup.sourceConnectionId);
        if (sourceBackend && sourceBackend.connectionType !== 'team-hub') {
          try {
            await sourceBackend.db.deleteCollection(cleanup.sourceProviderCollectionId);
          } catch (err) {
            console.warn(
              `Failed to recover stale source collection after move (global id ${globalId}):`,
              err
            );
            continue;
          }
        } else if (sourceBackend?.connectionType === 'team-hub') {
          this.clearPendingMoveCleanup(globalId);
          continue;
        }

        this.clearPendingMoveCleanup(globalId);
      } catch (err) {
        console.warn(`Failed to recover pending move cleanup for collection ${globalIdStr}:`, err);
      }
    }
  }

  /**
   * Reads the pending move cleanup map from registry settings.
   *
   * @returns Parsed cleanup entries keyed by global collection id string.
   */
  private readPendingMoveCleanups(): PendingMoveCleanupMap {
    const raw = this.internals.database.getSetting(COLLECTION_MOVE_PENDING_KEY);
    if (!raw) return {};

    try {
      return JSON.parse(raw) as PendingMoveCleanupMap;
    } catch {
      return {};
    }
  }

  /**
   * Records a pending source cleanup after a successful move copy.
   *
   * @param globalId - Global collection id.
   * @param sourceConnectionId - Connection that still holds the source copy.
   * @param sourceProviderCollectionId - Provider-local id of the source copy.
   */
  private writePendingMoveCleanup(
    globalId: number,
    sourceConnectionId: string,
    sourceProviderCollectionId: number
  ): void {
    const pending = this.readPendingMoveCleanups();
    pending[String(globalId)] = { sourceConnectionId, sourceProviderCollectionId };
    this.internals.database.setSetting(COLLECTION_MOVE_PENDING_KEY, JSON.stringify(pending));
  }

  /**
   * Removes a pending move cleanup entry after source deletion succeeds.
   *
   * @param globalId - Global collection id whose cleanup entry to remove.
   */
  private clearPendingMoveCleanup(globalId: number): void {
    const pending = this.readPendingMoveCleanups();
    delete pending[String(globalId)];
    this.internals.database.setSetting(COLLECTION_MOVE_PENDING_KEY, JSON.stringify(pending));
  }

  /**
   * Rolls back a partially created target collection when a move fails mid-flight.
   *
   * @param targetBackend - Destination provider backend.
   * @param targetProviderCollectionId - Provider-local id of the partial target copy.
   * @param globalCollectionId - Global collection id being moved.
   * @param sourceConnectionId - Original connection id before the failed move.
   * @param sourceProviderCollectionId - Original provider-local collection id.
   */
  private async cleanupPartialMoveTarget(
    targetBackend: MountedBackend,
    targetProviderCollectionId: number,
    globalCollectionId: number,
    sourceConnectionId: string,
    sourceProviderCollectionId: number
  ): Promise<void> {
    const current = this.internals.database.getRegistryEntry(globalCollectionId);
    if (
      current?.connectionId !== sourceConnectionId ||
      current?.providerCollectionId !== sourceProviderCollectionId
    ) {
      return;
    }

    try {
      await targetBackend.db.deleteCollection(targetProviderCollectionId);
    } catch (cleanupErr) {
      console.warn('Failed to clean up partial move target collection:', cleanupErr);
    }
  }
}

/**
 * Recreates folders, saved requests, and markdown documents inside a target provider collection.
 *
 * @param targetBackend - Backend that owns the destination collection.
 * @param targetCollectionId - Provider-local id of the destination collection.
 * @param folders - Source folders to copy (provider-local ids).
 * @param requests - Source requests to copy (provider-local ids).
 * @param documents - Source markdown documents to copy (provider-local ids).
 */
async function copyCollectionContents(
  targetBackend: MountedBackend,
  targetCollectionId: number,
  folders: Folder[],
  requests: SavedRequest[],
  documents: CollectionDocument[]
): Promise<void> {
  const folderIdMap = new Map<number, number>();
  const sortedFolders = [...folders].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
  for (const folder of sortedFolders) {
    const createdFolder = await targetBackend.db.createFolder(targetCollectionId, folder.name);
    await targetBackend.db.updateFolder(
      createdFolder.id,
      folder.name,
      folder.variables,
      folder.headers,
      folder.pre_request_script,
      folder.post_request_script,
      folder.auth,
      folder.pre_request_scripts,
      folder.post_request_scripts
    );
    folderIdMap.set(folder.id, createdFolder.id);
  }
  if (sortedFolders.length > 0) {
    await targetBackend.db.reorderFolders(
      targetCollectionId,
      sortedFolders.map((folder) => folderIdMap.get(folder.id)!)
    );
  }

  const sortedRequests = [...requests].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  for (const request of sortedRequests) {
    const targetFolderId =
      request.folder_id != null ? (folderIdMap.get(request.folder_id) ?? null) : null;

    await targetBackend.db.saveRequest({
      collection_id: targetCollectionId,
      folder_id: targetFolderId,
      name: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers,
      params: request.params,
      auth: request.auth,
      body: request.body,
      body_type: request.body_type,
      body_raw: request.body_raw ?? null,
      body_raw_open: request.body_raw_open === true,
      pre_request_script: request.pre_request_script,
      post_request_script: request.post_request_script,
      pre_request_scripts: request.pre_request_scripts,
      post_request_scripts: request.post_request_scripts,
      comment: request.comment,
      tags: request.tags
    });
  }

  const sortedDocuments = [...documents].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  for (const document of sortedDocuments) {
    const targetFolderId =
      document.folder_id != null ? (folderIdMap.get(document.folder_id) ?? null) : null;

    await targetBackend.db.saveDocument({
      collection_id: targetCollectionId,
      folder_id: targetFolderId,
      name: document.name,
      content: document.content,
      uuid: document.uuid,
      sort_order: document.sort_order
    });
  }
}
