import type {
  CreateLiveServerInput,
  LiveServer,
  UpdateLiveServerInput
} from '@harborclient/core/types';
import type { LiveServerRegistryEntry, LocalDatabase } from './LocalDatabase';
import type { MountedBackend } from './routingInternals';

const LIVE_SERVER_MOVE_PENDING_KEY = 'live_server_move_pending';

interface PendingMoveCleanup {
  sourceConnectionId: string;
  sourceProviderId: number;
}

type PendingMoveCleanupMap = Record<string, PendingMoveCleanup>;

/**
 * Dependencies used to route and merge live-server move operations.
 */
export interface LiveServerRoutingInternals {
  readonly database: LocalDatabase;
  getBackend(connectionId: string): MountedBackend | undefined;
  requireBackendByConnectionId(connectionId: string): MountedBackend;
  requireEntry(id: number): LiveServerRegistryEntry;
  build(entry: LiveServerRegistryEntry, record: LiveServer | undefined): LiveServer;
  resolveServerId(connectionId: string, providerId: number): string | undefined;
  addDetachedServerId(hubId: string, serverId: string): void;
}

/**
 * Copies live servers between providers while preserving registry ids.
 */
export class LiveServerMoveCoordinator {
  /**
   * @param internals - Routing operations supplied by RoutingStorage.
   */
  constructor(private readonly internals: LiveServerRoutingInternals) {}

  /**
   * Moves one live server to a different mounted provider.
   *
   * @param id - Stable global registry id.
   * @param targetConnectionId - Destination provider connection id.
   * @returns The routed live server after the move.
   */
  async move(id: number, targetConnectionId: string): Promise<LiveServer> {
    const entry = this.internals.requireEntry(id);
    const sourceBackend = this.internals.requireBackendByConnectionId(entry.connectionId);
    const source = (await sourceBackend.db.listLiveServers()).find(
      (record) => record.id === entry.providerLiveServerId
    );
    if (!source) throw new Error(`Live server not found: ${id}`);
    if (entry.connectionId === targetConnectionId) return this.internals.build(entry, source);

    const targetBackend = this.internals.requireBackendByConnectionId(targetConnectionId);
    let targetProviderId: number | undefined;
    try {
      const created = await targetBackend.db.createLiveServer(toCreateInput(source));
      const updated = await targetBackend.db.updateLiveServer(toUpdateInput(created.id, source));
      targetProviderId = updated.id;
      const updatedEntry = this.internals.database.updateLiveServerRegistryEntry(id, {
        name: updated.name,
        uuid: updated.uuid,
        connectionId: targetConnectionId,
        providerLiveServerId: updated.id
      });
      const leaveSourceIntact = sourceBackend.connectionType === 'team-hub';
      if (!leaveSourceIntact) {
        this.writePending(id, entry.connectionId, entry.providerLiveServerId);
      }
      try {
        if (leaveSourceIntact) {
          const serverId = this.internals.resolveServerId(
            entry.connectionId,
            entry.providerLiveServerId
          );
          if (serverId) this.internals.addDetachedServerId(entry.connectionId, serverId);
        } else {
          await sourceBackend.db.deleteLiveServer(entry.providerLiveServerId);
          this.clearPending(id);
        }
      } catch (err) {
        console.warn(`Live server moved but source cleanup failed (global id ${id}):`, err);
      }
      return this.internals.build(updatedEntry, updated);
    } catch (err) {
      if (targetProviderId != null) {
        const current = this.internals.database.getLiveServerRegistryEntry(id);
        if (
          current?.connectionId === entry.connectionId &&
          current.providerLiveServerId === entry.providerLiveServerId
        ) {
          try {
            await targetBackend.db.deleteLiveServer(targetProviderId);
          } catch (cleanupErr) {
            console.warn('Failed to clean up partial live-server move target:', cleanupErr);
          }
        }
      }
      throw err;
    }
  }

  /**
   * Retries source deletion for moves interrupted after registry reassignment.
   */
  async recoverPendingMoveCleanups(): Promise<void> {
    for (const [idText, cleanup] of Object.entries(this.readPending())) {
      const id = Number(idText);
      try {
        const entry = this.internals.database.getLiveServerRegistryEntry(id);
        if (
          !entry ||
          (entry.connectionId === cleanup.sourceConnectionId &&
            entry.providerLiveServerId === cleanup.sourceProviderId)
        ) {
          this.clearPending(id);
          continue;
        }
        const source = this.internals.getBackend(cleanup.sourceConnectionId);
        if (source && source.connectionType !== 'team-hub') {
          await source.db.deleteLiveServer(cleanup.sourceProviderId);
        }
        this.clearPending(id);
      } catch (err) {
        console.warn(`Failed to recover pending live-server move cleanup ${idText}:`, err);
      }
    }
  }

  /**
   * Reads pending cleanup metadata from local settings.
   *
   * @returns Parsed pending move map.
   */
  private readPending(): PendingMoveCleanupMap {
    const raw = this.internals.database.getSetting(LIVE_SERVER_MOVE_PENDING_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as PendingMoveCleanupMap;
    } catch {
      return {};
    }
  }

  /**
   * Persists source cleanup metadata before deleting the old provider record.
   *
   * @param id - Global registry id.
   * @param sourceConnectionId - Original provider connection.
   * @param sourceProviderId - Original provider-local id.
   */
  private writePending(id: number, sourceConnectionId: string, sourceProviderId: number): void {
    const pending = this.readPending();
    pending[String(id)] = { sourceConnectionId, sourceProviderId };
    this.internals.database.setSetting(LIVE_SERVER_MOVE_PENDING_KEY, JSON.stringify(pending));
  }

  /**
   * Clears completed source cleanup metadata.
   *
   * @param id - Global registry id.
   */
  private clearPending(id: number): void {
    const pending = this.readPending();
    delete pending[String(id)];
    this.internals.database.setSetting(LIVE_SERVER_MOVE_PENDING_KEY, JSON.stringify(pending));
  }
}

/**
 * Copies every portable live-server field into a provider create payload.
 *
 * @param source - Provider record being copied.
 * @returns Complete create payload.
 */
function toCreateInput(source: LiveServer): CreateLiveServerInput {
  return {
    name: source.name,
    uuid: source.uuid,
    root: source.root,
    port: source.port,
    aliases: source.aliases,
    watch: source.watch,
    cors: source.cors,
    openPath: source.openPath,
    openPathOnStartup: source.openPathOnStartup,
    rememberLastUrl: source.rememberLastUrl,
    lastOpenedPath: null,
    indexFiles: source.indexFiles,
    host: source.host,
    headers: source.headers,
    routes: source.routes,
    errorPages: source.errorPages,
    proxies: source.proxies,
    ssl: source.ssl,
    runCommand: source.runCommand,
    runtimeId: source.runtimeId,
    runCommandEnabled: source.runCommandEnabled,
    runCommandEnv: source.runCommandEnv,
    restartOnCrash: source.restartOnCrash,
    urlVariable: source.urlVariable,
    preRequestScripts: source.preRequestScripts,
    postRequestScripts: source.postRequestScripts
  };
}

/**
 * Copies every mutable live-server field into a provider update payload.
 *
 * @param id - Destination provider-local id.
 * @param source - Source provider record.
 * @returns Complete update payload.
 */
function toUpdateInput(id: number, source: LiveServer): UpdateLiveServerInput {
  return {
    id,
    name: source.name,
    root: source.root,
    port: source.port,
    aliases: source.aliases,
    watch: source.watch,
    cors: source.cors,
    openPath: source.openPath,
    openPathOnStartup: source.openPathOnStartup,
    rememberLastUrl: source.rememberLastUrl,
    lastOpenedPath: null,
    indexFiles: source.indexFiles,
    host: source.host,
    headers: source.headers,
    routes: source.routes,
    errorPages: source.errorPages,
    proxies: source.proxies,
    ssl: source.ssl,
    runCommand: source.runCommand,
    runtimeId: source.runtimeId,
    runCommandEnabled: source.runCommandEnabled,
    runCommandEnv: source.runCommandEnv,
    restartOnCrash: source.restartOnCrash,
    urlVariable: source.urlVariable,
    preRequestScripts: source.preRequestScripts,
    postRequestScripts: source.postRequestScripts
  };
}
