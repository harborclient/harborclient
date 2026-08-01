import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from '@harborclient/core/types';
import type { LivePageRegistryEntry, LocalDatabase } from './LocalDatabase';
import type { MountedBackend } from './routingInternals';

const LIVE_PAGE_MOVE_PENDING_KEY = 'live_page_move_pending';

interface PendingMoveCleanup {
  sourceConnectionId: string;
  sourceProviderId: number;
}

type PendingMoveCleanupMap = Record<string, PendingMoveCleanup>;

/**
 * Dependencies used to route and merge live-page move operations.
 */
export interface LivePageRoutingInternals {
  readonly database: LocalDatabase;
  getBackend(connectionId: string): MountedBackend | undefined;
  requireBackendByConnectionId(connectionId: string): MountedBackend;
  requireEntry(id: number): LivePageRegistryEntry;
  build(entry: LivePageRegistryEntry, record: Website | undefined): Website;
  resolveServerId(connectionId: string, providerId: number): string | undefined;
  addDetachedServerId(hubId: string, serverId: string): void;
}

/**
 * Copies live pages between providers while preserving registry ids.
 */
export class LivePageMoveCoordinator {
  /**
   * @param internals - Routing operations supplied by RoutingStorage.
   */
  constructor(private readonly internals: LivePageRoutingInternals) {}

  /**
   * Moves one live page to a different mounted provider.
   *
   * @param id - Stable global registry id.
   * @param targetConnectionId - Destination provider connection id.
   * @returns The routed live page after the move.
   */
  async move(id: number, targetConnectionId: string): Promise<Website> {
    const entry = this.internals.requireEntry(id);
    const sourceBackend = this.internals.requireBackendByConnectionId(entry.connectionId);
    const source = (await sourceBackend.db.listLivePages()).find(
      (record) => record.id === entry.providerLivePageId
    );
    if (!source) throw new Error(`Live page not found: ${id}`);
    if (entry.connectionId === targetConnectionId) return this.internals.build(entry, source);

    const targetBackend = this.internals.requireBackendByConnectionId(targetConnectionId);
    let targetProviderId: number | undefined;
    try {
      const created = await targetBackend.db.createLivePage(toCreateInput(source));
      const updated = await targetBackend.db.updateLivePage(toUpdateInput(created.id, source));
      targetProviderId = updated.id;
      const updatedEntry = this.internals.database.updateLivePageRegistryEntry(id, {
        name: updated.name,
        uuid: updated.uuid,
        connectionId: targetConnectionId,
        providerLivePageId: updated.id
      });
      const leaveSourceIntact = sourceBackend.connectionType === 'team-hub';
      if (!leaveSourceIntact) {
        this.writePending(id, entry.connectionId, entry.providerLivePageId);
      }
      try {
        if (leaveSourceIntact) {
          const serverId = this.internals.resolveServerId(
            entry.connectionId,
            entry.providerLivePageId
          );
          if (serverId) this.internals.addDetachedServerId(entry.connectionId, serverId);
        } else {
          await sourceBackend.db.deleteLivePage(entry.providerLivePageId);
          this.clearPending(id);
        }
      } catch (err) {
        console.warn(`Live page moved but source cleanup failed (global id ${id}):`, err);
      }
      return this.internals.build(updatedEntry, updated);
    } catch (err) {
      if (targetProviderId != null) {
        const current = this.internals.database.getLivePageRegistryEntry(id);
        if (
          current?.connectionId === entry.connectionId &&
          current.providerLivePageId === entry.providerLivePageId
        ) {
          try {
            await targetBackend.db.deleteLivePage(targetProviderId);
          } catch (cleanupErr) {
            console.warn('Failed to clean up partial live-page move target:', cleanupErr);
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
        const entry = this.internals.database.getLivePageRegistryEntry(id);
        if (
          !entry ||
          (entry.connectionId === cleanup.sourceConnectionId &&
            entry.providerLivePageId === cleanup.sourceProviderId)
        ) {
          this.clearPending(id);
          continue;
        }
        const source = this.internals.getBackend(cleanup.sourceConnectionId);
        if (source && source.connectionType !== 'team-hub') {
          await source.db.deleteLivePage(cleanup.sourceProviderId);
        }
        this.clearPending(id);
      } catch (err) {
        console.warn(`Failed to recover pending live-page move cleanup ${idText}:`, err);
      }
    }
  }

  /**
   * Reads pending cleanup metadata from local settings.
   *
   * @returns Parsed pending move map.
   */
  private readPending(): PendingMoveCleanupMap {
    const raw = this.internals.database.getSetting(LIVE_PAGE_MOVE_PENDING_KEY);
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
    this.internals.database.setSetting(LIVE_PAGE_MOVE_PENDING_KEY, JSON.stringify(pending));
  }

  /**
   * Clears completed source cleanup metadata.
   *
   * @param id - Global registry id.
   */
  private clearPending(id: number): void {
    const pending = this.readPending();
    delete pending[String(id)];
    this.internals.database.setSetting(LIVE_PAGE_MOVE_PENDING_KEY, JSON.stringify(pending));
  }
}

/**
 * Copies every portable live-page field into a provider create payload.
 *
 * @param source - Provider record being copied.
 * @returns Complete create payload.
 */
function toCreateInput(source: Website): CreateWebsiteInput {
  return {
    name: source.name,
    uuid: source.uuid,
    url: source.url,
    homeUrl: source.homeUrl,
    faviconDataUrl: source.faviconDataUrl,
    scripts: source.scripts,
    preRequestScripts: source.preRequestScripts,
    postRequestScripts: source.postRequestScripts,
    variables: source.variables,
    headers: source.headers,
    userAgent: source.userAgent,
    auth: source.auth
  };
}

/**
 * Copies every mutable live-page field into a provider update payload.
 *
 * @param id - Destination provider-local id.
 * @param source - Source provider record.
 * @returns Complete update payload.
 */
function toUpdateInput(id: number, source: Website): UpdateWebsiteInput {
  return {
    id,
    name: source.name,
    url: source.url,
    homeUrl: source.homeUrl,
    faviconDataUrl: source.faviconDataUrl,
    scripts: source.scripts,
    preRequestScripts: source.preRequestScripts,
    postRequestScripts: source.postRequestScripts,
    variables: source.variables,
    headers: source.headers,
    userAgent: source.userAgent,
    auth: source.auth
  };
}
