import type { MountedBackend, RoutingInternals } from '#/main/db/routingInternals';
import type { Collection } from '#/shared/types';

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
   * @param internals - Shared routing context from RoutingDatabase.
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

    let targetProviderCollectionId: number | undefined;

    try {
      const created = await targetBackend.db.createCollection(record.name);
      const updated = await targetBackend.db.updateCollection(
        created.id,
        record.name,
        record.variables,
        record.headers,
        record.pre_request_script,
        record.post_request_script
      );
      targetProviderCollectionId = updated.id;

      const folderIdMap = new Map<number, number>();
      const sortedFolders = [...folders].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
      );
      for (const folder of sortedFolders) {
        const createdFolder = await targetBackend.db.createFolder(updated.id, folder.name);
        folderIdMap.set(folder.id, createdFolder.id);
      }
      if (sortedFolders.length > 0) {
        await targetBackend.db.reorderFolders(
          updated.id,
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
          collection_id: updated.id,
          folder_id: targetFolderId,
          name: request.name,
          method: request.method,
          url: request.url,
          headers: request.headers,
          params: request.params,
          body: request.body,
          body_type: request.body_type,
          pre_request_script: request.pre_request_script,
          post_request_script: request.post_request_script,
          comment: request.comment
        });
      }

      const updatedEntry = this.internals.registry.updateRegistryEntry(globalCollectionId, {
        name: record.name,
        connectionId: targetConnectionId,
        providerCollectionId: updated.id
      });

      this.writePendingMoveCleanup(
        globalCollectionId,
        sourceConnectionId,
        sourceProviderCollectionId
      );

      try {
        await sourceBackend.db.deleteCollection(sourceProviderCollectionId);
        this.clearPendingMoveCleanup(globalCollectionId);
      } catch (err) {
        console.warn(
          `Collection moved but source cleanup failed; will retry on next launch (global id ${globalCollectionId}):`,
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
   * Deletes stale source copies left behind by interrupted collection moves.
   */
  async recoverPendingMoveCleanups(): Promise<void> {
    const pending = this.readPendingMoveCleanups();

    for (const [globalIdStr, cleanup] of Object.entries(pending)) {
      const globalId = Number(globalIdStr);

      try {
        const entry = this.internals.registry.getRegistryEntry(globalId);
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
        if (sourceBackend) {
          try {
            await sourceBackend.db.deleteCollection(cleanup.sourceProviderCollectionId);
          } catch (err) {
            console.warn(
              `Failed to recover stale source collection after move (global id ${globalId}):`,
              err
            );
            continue;
          }
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
    const raw = this.internals.registry.getSetting(COLLECTION_MOVE_PENDING_KEY);
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
    this.internals.registry.setSetting(COLLECTION_MOVE_PENDING_KEY, JSON.stringify(pending));
  }

  /**
   * Removes a pending move cleanup entry after source deletion succeeds.
   *
   * @param globalId - Global collection id whose cleanup entry to remove.
   */
  private clearPendingMoveCleanup(globalId: number): void {
    const pending = this.readPendingMoveCleanups();
    delete pending[String(globalId)];
    this.internals.registry.setSetting(COLLECTION_MOVE_PENDING_KEY, JSON.stringify(pending));
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
    const current = this.internals.registry.getRegistryEntry(globalCollectionId);
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
