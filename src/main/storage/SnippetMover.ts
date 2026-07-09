import type { MountedBackend, RoutingInternals } from '#/main/storage/routingInternals';
import type { SnippetRegistryEntry, LocalDatabase } from '#/main/storage/LocalDatabase';
import type { Snippet } from '#/shared/types';
import { rethrowTeamHubSnippetCreateError } from '#/main/storage/teamHubSnippetErrors';

const SNIPPET_MOVE_PENDING_KEY = 'snippet_move_pending';

interface PendingSnippetMoveCleanup {
  sourceConnectionId: string;
  sourceProviderSnippetId: number;
}

type PendingSnippetMoveCleanupMap = Record<string, PendingSnippetMoveCleanup>;

/**
 * Internal snippet routing context shared by move helpers.
 */
export interface SnippetRoutingInternals {
  readonly database: LocalDatabase;
  getBackend(connectionId: string): MountedBackend | undefined;
  requireBackendByConnectionId(connectionId: string): MountedBackend;
  requireSnippetEntry(id: number): SnippetRegistryEntry;
  buildSnippet(entry: SnippetRegistryEntry, record: Snippet | undefined): Snippet;
  resolveSnippetServerId(connectionId: string, providerSnippetId: number): string | undefined;
  addDetachedTeamHubSnippet(hubId: string, serverSnippetId: string): void;
}

/**
 * Orchestrates snippet moves between database providers and recovers
 * interrupted moves on startup.
 */
export class SnippetMoveCoordinator {
  private readonly internals: SnippetRoutingInternals;

  /**
   * @param internals - Shared snippet routing context from RoutingStorage.
   */
  constructor(internals: SnippetRoutingInternals) {
    this.internals = internals;
  }

  /**
   * Moves a snippet's data to another provider, keeping its global id stable.
   *
   * @param globalSnippetId - Registry (global) snippet id.
   * @param targetConnectionId - Connection id of the destination provider.
   * @returns The snippet with updated connection metadata.
   */
  async moveSnippet(globalSnippetId: number, targetConnectionId: string): Promise<Snippet> {
    const entry = this.internals.requireSnippetEntry(globalSnippetId);

    if (entry.connectionId === targetConnectionId) {
      const sourceBackend = this.internals.getBackend(entry.connectionId);
      const record = sourceBackend
        ? (await sourceBackend.db.listSnippets()).find(
            (item) => item.id === entry.providerSnippetId
          )
        : undefined;
      return this.internals.buildSnippet(entry, record);
    }

    const sourceBackend = this.internals.requireBackendByConnectionId(entry.connectionId);
    const targetBackend = this.internals.requireBackendByConnectionId(targetConnectionId);

    const sourceSnippets = await sourceBackend.db.listSnippets();
    const record = sourceSnippets.find((item) => item.id === entry.providerSnippetId);
    if (!record) {
      throw new Error(`Snippet not found: ${globalSnippetId}`);
    }

    const sourceConnectionId = entry.connectionId;
    const sourceProviderSnippetId = entry.providerSnippetId;

    let targetProviderSnippetId: number | undefined;

    try {
      const created = await this.createTargetSnippet(targetBackend, record);
      const updated = await targetBackend.db.updateSnippet(
        created.id,
        record.name,
        record.code,
        record.scope,
        record.stage
      );
      targetProviderSnippetId = updated.id;

      const updatedEntry = this.internals.database.updateSnippetRegistryEntry(globalSnippetId, {
        name: record.name,
        connectionId: targetConnectionId,
        providerSnippetId: updated.id,
        uuid: record.uuid,
        scope: record.scope
      });

      const leaveSourceIntact = sourceBackend.connectionType === 'team-hub';

      if (!leaveSourceIntact) {
        this.writePendingMoveCleanup(globalSnippetId, sourceConnectionId, sourceProviderSnippetId);
      }

      try {
        if (leaveSourceIntact) {
          const serverSnippetId = this.internals.resolveSnippetServerId(
            sourceConnectionId,
            sourceProviderSnippetId
          );
          if (serverSnippetId) {
            this.internals.addDetachedTeamHubSnippet(sourceConnectionId, serverSnippetId);
          }
        } else {
          await sourceBackend.db.deleteSnippet(sourceProviderSnippetId);
          this.clearPendingMoveCleanup(globalSnippetId);
        }
      } catch (err) {
        console.warn(
          leaveSourceIntact
            ? `Snippet moved but failed to detach from team hub (global id ${globalSnippetId}):`
            : `Snippet moved but source cleanup failed; will retry on next launch (global id ${globalSnippetId}):`,
          err
        );
      }

      return this.internals.buildSnippet(updatedEntry, updated);
    } catch (err) {
      if (targetProviderSnippetId != null) {
        await this.cleanupPartialMoveTarget(
          targetBackend,
          targetProviderSnippetId,
          globalSnippetId,
          sourceConnectionId,
          sourceProviderSnippetId
        );
      }
      throw err;
    }
  }

  /**
   * Creates the destination copy of a snippet, translating a missing-feature
   * response from older team hubs into a clear, user-facing error.
   *
   * @param targetBackend - Destination provider backend.
   * @param record - Source snippet being copied.
   * @returns The snippet created on the destination provider.
   * @throws When the destination team hub does not support snippets.
   */
  private async createTargetSnippet(
    targetBackend: MountedBackend,
    record: Snippet
  ): Promise<Snippet> {
    try {
      return await targetBackend.db.createSnippet(
        record.name,
        record.code,
        record.scope,
        record.stage,
        record.uuid
      );
    } catch (err) {
      rethrowTeamHubSnippetCreateError(targetBackend, err);
    }
  }

  /**
   * Deletes stale source copies left behind by interrupted snippet moves.
   */
  async recoverPendingMoveCleanups(): Promise<void> {
    const pending = this.readPendingMoveCleanups();

    for (const [globalIdStr, cleanup] of Object.entries(pending)) {
      const globalId = Number(globalIdStr);

      try {
        const entry = this.internals.database.getSnippetRegistryEntry(globalId);
        if (!entry) {
          this.clearPendingMoveCleanup(globalId);
          continue;
        }

        if (
          entry.connectionId === cleanup.sourceConnectionId &&
          entry.providerSnippetId === cleanup.sourceProviderSnippetId
        ) {
          this.clearPendingMoveCleanup(globalId);
          continue;
        }

        const sourceBackend = this.internals.getBackend(cleanup.sourceConnectionId);
        if (sourceBackend && sourceBackend.connectionType !== 'team-hub') {
          try {
            await sourceBackend.db.deleteSnippet(cleanup.sourceProviderSnippetId);
          } catch (err) {
            console.warn(
              `Failed to recover stale source snippet after move (global id ${globalId}):`,
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
        console.warn(
          `Failed to recover pending snippet move cleanup for snippet ${globalIdStr}:`,
          err
        );
      }
    }
  }

  /**
   * Reads the pending snippet move cleanup map from registry settings.
   */
  private readPendingMoveCleanups(): PendingSnippetMoveCleanupMap {
    const raw = this.internals.database.getSetting(SNIPPET_MOVE_PENDING_KEY);
    if (!raw) return {};

    try {
      return JSON.parse(raw) as PendingSnippetMoveCleanupMap;
    } catch {
      return {};
    }
  }

  /**
   * Records a pending source cleanup after a successful snippet move copy.
   */
  private writePendingMoveCleanup(
    globalId: number,
    sourceConnectionId: string,
    sourceProviderSnippetId: number
  ): void {
    const pending = this.readPendingMoveCleanups();
    pending[String(globalId)] = { sourceConnectionId, sourceProviderSnippetId };
    this.internals.database.setSetting(SNIPPET_MOVE_PENDING_KEY, JSON.stringify(pending));
  }

  /**
   * Removes a pending snippet move cleanup entry after source deletion succeeds.
   */
  private clearPendingMoveCleanup(globalId: number): void {
    const pending = this.readPendingMoveCleanups();
    delete pending[String(globalId)];
    this.internals.database.setSetting(SNIPPET_MOVE_PENDING_KEY, JSON.stringify(pending));
  }

  /**
   * Rolls back a partially created target snippet when a move fails mid-flight.
   */
  private async cleanupPartialMoveTarget(
    targetBackend: MountedBackend,
    targetProviderSnippetId: number,
    globalSnippetId: number,
    sourceConnectionId: string,
    sourceProviderSnippetId: number
  ): Promise<void> {
    const current = this.internals.database.getSnippetRegistryEntry(globalSnippetId);
    if (
      current?.connectionId !== sourceConnectionId ||
      current?.providerSnippetId !== sourceProviderSnippetId
    ) {
      return;
    }

    try {
      await targetBackend.db.deleteSnippet(targetProviderSnippetId);
    } catch (cleanupErr) {
      console.warn('Failed to clean up partial move target snippet:', cleanupErr);
    }
  }
}

/**
 * Builds snippet routing internals from collection routing internals.
 *
 * @param collectionInternals - Existing collection routing context.
 * @param buildSnippet - Snippet merge helper from RoutingStorage.
 * @param resolveSnippetServerId - Resolves team hub server snippet uuid.
 * @param addDetachedTeamHubSnippet - Records detached team hub snippet uuid.
 */
export function createSnippetRoutingInternals(
  collectionInternals: RoutingInternals,
  buildSnippet: (entry: SnippetRegistryEntry, record: Snippet | undefined) => Snippet,
  resolveSnippetServerId: (connectionId: string, providerSnippetId: number) => string | undefined,
  addDetachedTeamHubSnippet: (hubId: string, serverSnippetId: string) => void
): SnippetRoutingInternals {
  return {
    database: collectionInternals.database,
    getBackend: (connectionId) => collectionInternals.getBackend(connectionId),
    requireBackendByConnectionId: (connectionId) =>
      collectionInternals.requireBackendByConnectionId(connectionId),
    requireSnippetEntry: (id) => {
      const entry = collectionInternals.database.getSnippetRegistryEntry(id);
      if (!entry) {
        throw new Error(`Snippet not found: ${id}`);
      }
      return entry;
    },
    buildSnippet,
    resolveSnippetServerId,
    addDetachedTeamHubSnippet
  };
}
