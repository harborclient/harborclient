import { MoveCoordinator } from './CollectionMover';
import {
  SnippetMoveCoordinator,
  createSnippetRoutingInternals,
  type SnippetRoutingInternals
} from './SnippetMover';
import { LiveServerMoveCoordinator, type LiveServerRoutingInternals } from './LiveServerMover';
import { LivePageMoveCoordinator, type LivePageRoutingInternals } from './LivePageMover';
import { createTeamHubStorage, teamHubIdMapPath } from './createTeamHubStorage';
import { TeamHubIdMap } from './TeamHubIdMap';
import {
  LocalDatabase,
  type CollectionRegistryEntry,
  type LivePageRegistryEntry,
  type LiveServerRegistryEntry,
  type SnippetRegistryEntry
} from './LocalDatabase';
import { MigrationManager } from './DatabaseMigrator';
import { createStorageInstance } from './createStorageInstance';
import { GitStorage } from './GitStorage';
import { classifyHarborChangePath } from '#/main/git/fileLayout';
import { isCollectionScopedHarborChange } from '#/main/git/gitDiff';
import { collectionDirName } from '#/main/git/slug';
import { decodeGlobalId, encodeGlobalId } from './idNamespace';
import type { ContainerItemRef } from '@harborclient/core/collectionContainerOrder';
import type { IStorage } from './IStorage';
import { TeamHubStorage } from './TeamHubStorage';
import {
  addDetachedServerId,
  addDetachedLivePageId,
  addDetachedLiveServerId,
  addDetachedSnippetServerId,
  readDetachedLivePageIds,
  readDetachedLiveServerIds,
  readDetachedServerIds,
  readDetachedSnippetServerIds,
  removeDetachedLivePageSetting,
  removeDetachedLiveServerSetting,
  removeDetachedSetting
} from './teamHubDetached';
import {
  rethrowTeamHubLivePageCreateError,
  rethrowTeamHubLiveServerCreateError
} from './teamHubLiveServerErrors';
import type { MountedBackend, ProviderDescriptor, RoutingInternals } from './routingInternals';
import {
  isTeamHubCollectionDeleteForbiddenError,
  isTeamHubSnippetsUnsupportedError
} from '@harborclient/team-hub-api';
import { logVerbose } from '#/main/logger';
import { isStorageConnectionConfigured } from '#/main/settings/storageSettings';
import { parseJson } from '@harborclient/core/parseJson';
import { getSlotForConnection } from '#/main/settings/storageSlots';
import { refreshTeamHubPluginSources } from '#/main/settings/teamHubPluginSources';
import { unlinkSync } from 'fs';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExport,
  CreateLiveServerInput,
  CreateWebsiteInput,
  DiscoveredCollection,
  StorageConnection,
  Environment,
  Folder,
  GitRequestFileStatus,
  KeyValue,
  LiveServer,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  SourceControlStatus,
  TeamHub,
  UpdateLiveServerInput,
  UpdateWebsiteInput,
  Variable,
  Website
} from '@harborclient/core/types';
import type { SnippetScope } from '@harborclient/core/snippetScope';
import { DEFAULT_SCRIPT_STAGE } from '@harborclient/core/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';
import { defaultAuth } from '@harborclient/core/auth';
import {
  normalizeLiveServerConfigFields,
  normalizeLiveServerCorsSettings
} from '@harborclient/core/types/liveServer';
import type {
  SavedRunResult,
  SavedRunResultSummary,
  SaveRunResultInput
} from '@harborclient/core/collectionRunner';

/**
 * Numeric id offset so marketplace snippet ids never collide with registry global ids.
 */
export const MARKETPLACE_SNIPPET_ID_OFFSET = 2_000_000_000;

/**
 * Formats a marketplace snippet row id for the merged renderer list.
 */
export function toMarketplaceSnippetGlobalId(localId: number): number {
  return MARKETPLACE_SNIPPET_ID_OFFSET + localId;
}

/**
 * Decodes a merged-list snippet id back to a marketplace registry row id.
 */
export function fromMarketplaceSnippetGlobalId(id: number): number | null {
  if (id < MARKETPLACE_SNIPPET_ID_OFFSET) {
    return null;
  }
  return id - MARKETPLACE_SNIPPET_ID_OFFSET;
}

/**
 * Formats a backend error for user-facing collection list warnings.
 *
 * @param err - Error thrown while reading collections from a provider.
 * @returns A short message suitable for toast display.
 */
function formatListCollectionError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Routes collection and request operations across multiple database backends.
 *
 * A hidden LocalDatabase holds the authoritative collection list,
 * environments, and app settings. Collection data and requests live in the
 * mapped provider. Request ids are namespaced per backend; collection ids
 * come from the registry.
 */
export class RoutingStorage implements IStorage {
  private readonly database: LocalDatabase;
  private defaultDataConnectionId: string;
  private readonly userDataPath: string;
  private readonly byConnectionId = new Map<string, MountedBackend>();
  private readonly bySlot = new Map<number, MountedBackend>();
  private listCollectionWarnings: string[] = [];
  private internalsCache?: RoutingInternals;
  private moverCache?: MoveCoordinator;
  private snippetMoverCache?: SnippetMoveCoordinator;
  private liveServerMoverCache?: LiveServerMoveCoordinator;
  private livePageMoverCache?: LivePageMoveCoordinator;
  private migratorCache?: MigrationManager;

  /**
   * @param database - Hidden local store for collection metadata, environments, and settings.
   * @param defaultDataConnectionId - Preferred provider for new collection data.
   * @param userDataPath - Electron userData path for provider-local files.
   */
  constructor(database: LocalDatabase, defaultDataConnectionId: string, userDataPath: string) {
    this.database = database;
    this.defaultDataConnectionId = defaultDataConnectionId;
    this.userDataPath = userDataPath;
  }

  /**
   * Lazily constructed move coordinator sharing this router's internal context.
   */
  private get mover(): MoveCoordinator {
    return (this.moverCache ??= new MoveCoordinator(this.internals));
  }

  /**
   * Lazily constructed snippet move coordinator sharing this router's internal context.
   */
  private get snippetMover(): SnippetMoveCoordinator {
    return (this.snippetMoverCache ??= new SnippetMoveCoordinator(this.snippetInternals));
  }

  /**
   * Lazily constructs the live-server move coordinator.
   */
  private get liveServerMover(): LiveServerMoveCoordinator {
    return (this.liveServerMoverCache ??= new LiveServerMoveCoordinator(this.liveServerInternals));
  }

  /**
   * Supplies registry and provider operations to live-server moves.
   */
  private get liveServerInternals(): LiveServerRoutingInternals {
    return {
      database: this.database,
      getBackend: (connectionId) => this.byConnectionId.get(connectionId),
      requireBackendByConnectionId: (connectionId) =>
        this.requireBackendByConnectionId(connectionId),
      requireEntry: (id) => this.requireLiveServerEntry(id),
      build: (entry, record) => this.buildLiveServer(entry, record),
      resolveServerId: (connectionId, providerId) => {
        const backend = this.byConnectionId.get(connectionId);
        if (backend?.db instanceof TeamHubStorage) {
          return backend.db.getServerLiveServerId(providerId);
        }
        return this.database
          .listLiveServerRegistry()
          .find(
            (entry) =>
              entry.connectionId === connectionId && entry.providerLiveServerId === providerId
          )?.uuid;
      },
      addDetachedServerId: (hubId, serverId) =>
        addDetachedLiveServerId(this.database, hubId, serverId)
    };
  }

  /**
   * Lazily constructs the live-page move coordinator.
   */
  private get livePageMover(): LivePageMoveCoordinator {
    return (this.livePageMoverCache ??= new LivePageMoveCoordinator(this.livePageInternals));
  }

  /**
   * Supplies registry and provider operations to live-page moves.
   */
  private get livePageInternals(): LivePageRoutingInternals {
    return {
      database: this.database,
      getBackend: (connectionId) => this.byConnectionId.get(connectionId),
      requireBackendByConnectionId: (connectionId) =>
        this.requireBackendByConnectionId(connectionId),
      requireEntry: (id) => this.requireLivePageEntry(id),
      build: (entry, record) => this.buildLivePage(entry, record),
      resolveServerId: (connectionId, providerId) => {
        const backend = this.byConnectionId.get(connectionId);
        if (backend?.db instanceof TeamHubStorage) {
          return backend.db.getServerLivePageId(providerId);
        }
        return this.database
          .listLivePageRegistry()
          .find(
            (entry) =>
              entry.connectionId === connectionId && entry.providerLivePageId === providerId
          )?.uuid;
      },
      addDetachedServerId: (hubId, serverId) =>
        addDetachedLivePageId(this.database, hubId, serverId)
    };
  }

  /**
   * Shared internal context for snippet move helpers.
   */
  private get snippetInternals(): SnippetRoutingInternals {
    return createSnippetRoutingInternals(
      this.internals,
      (entry, record) => this.buildSnippet(entry, record),
      (connectionId, providerSnippetId) => {
        const backend = this.byConnectionId.get(connectionId);
        if (!backend || backend.connectionType !== 'team-hub') {
          return undefined;
        }
        if (!(backend.db instanceof TeamHubStorage)) {
          return undefined;
        }
        return backend.db.getServerSnippetId(providerSnippetId);
      },
      (hubId, serverSnippetId) => {
        addDetachedSnippetServerId(this.database, hubId, serverSnippetId);
      }
    );
  }

  /**
   * Lazily constructed migration manager sharing this router's internal context.
   */
  private get migrator(): MigrationManager {
    return (this.migratorCache ??= new MigrationManager(this.internals));
  }

  /**
   * Shared internal context for move and migration helpers.
   */
  private get internals(): RoutingInternals {
    return (this.internalsCache ??= this.createInternals());
  }

  /**
   * Registers an initialized backend at the given slot.
   */
  mount(slot: number, provider: ProviderDescriptor, db: IStorage, teamHubBaseUrl?: string): void {
    const backend: MountedBackend = {
      slot,
      connectionId: provider.id,
      connectionName: provider.name,
      connectionType: provider.type,
      db,
      teamHubBaseUrl
    };
    this.byConnectionId.set(provider.id, backend);
    this.bySlot.set(slot, backend);
  }

  /**
   * Returns true when at least one data provider backend is mounted.
   */
  hasAnyBackend(): boolean {
    return this.byConnectionId.size > 0;
  }

  /**
   * Returns true when the default data provider is mounted.
   */
  hasDefaultProvider(): boolean {
    return this.byConnectionId.has(this.defaultDataConnectionId);
  }

  /**
   * Returns true when a provider backend is mounted for the given connection id.
   *
   * @param connectionId - Database or team hub connection id.
   */
  isConnectionMounted(connectionId: string): boolean {
    return this.byConnectionId.has(connectionId);
  }

  /**
   * Sets the default data connection id when the preferred provider is unavailable.
   */
  setDefaultDataConnectionId(connectionId: string): void {
    this.defaultDataConnectionId = connectionId;
  }

  /**
   * Initializes all mounted backends (no-op; backends are initialized before mount).
   */
  async init(): Promise<void> {
    // Backends are initialized before being mounted.
  }

  /**
   * Flushes WAL pages for the registry and mounted SQLite providers before backup.
   */
  checkpointWalForBackup(): void {
    this.database.checkpointWal();
    for (const backend of this.byConnectionId.values()) {
      if (backend.connectionType !== 'sqlite') continue;
      const sqliteDb = backend.db as { checkpointWal?: () => void };
      sqliteDb.checkpointWal?.();
    }
  }

  /**
   * Closes every mounted provider and the registry.
   */
  async close(): Promise<void> {
    await Promise.all([...this.byConnectionId.values()].map((backend) => backend.db.close()));
    await this.database.close();
  }

  /**
   * Returns and clears warnings recorded during the most recent listCollections call.
   */
  consumeCollectionListWarnings(): string[] {
    const warnings = this.listCollectionWarnings;
    this.listCollectionWarnings = [];
    return warnings;
  }

  /**
   * Returns source-control status for each mounted git-backed connection.
   */
  async listGitStatuses(): Promise<Record<string, SourceControlStatus>> {
    const statuses: Record<string, SourceControlStatus> = {};
    for (const backend of this.byConnectionId.values()) {
      if (backend.connectionType !== 'git') {
        continue;
      }
      try {
        const status = await backend.db.getSourceControlStatus();
        if (status) {
          statuses[backend.connectionId] = status;
        }
      } catch (err) {
        console.error(`Failed to read git status for connection "${backend.connectionId}":`, err);
      }
    }
    return statuses;
  }

  /**
   * Looks up a collection in a git-backed connection without throwing on miss.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   */
  private async lookupGitCollection(
    connectionId: string,
    collectionUuid: string
  ): Promise<{ gitDb: GitStorage; collection: Collection } | null> {
    const gitDb = this.requireGitStorage(connectionId);
    const collection = await gitDb.findCollectionByUuid(collectionUuid.trim());
    return collection ? { gitDb, collection } : null;
  }

  /**
   * Resolves git storage and collection or throws when the uuid is unknown.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   */
  private async resolveGitCollection(
    connectionId: string,
    collectionUuid: string
  ): Promise<{ gitDb: GitStorage; collection: Collection }> {
    const resolved = await this.lookupGitCollection(connectionId, collectionUuid);
    if (!resolved) {
      throw new Error(`Collection not found for uuid "${collectionUuid}".`);
    }
    return resolved;
  }

  /**
   * Returns per-item git status for requests and markdown documents in one collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   */
  async getGitItemStatuses(
    connectionId: string,
    collectionUuid: string
  ): Promise<Record<string, GitRequestFileStatus>> {
    const { gitDb, collection } = await this.resolveGitCollection(connectionId, collectionUuid);
    return gitDb.getItemGitStatuses(collection.id);
  }

  /**
   * Returns the number of changed request/document files in one git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   */
  async getGitChangedItemCount(connectionId: string, collectionUuid: string): Promise<number> {
    const resolved = await this.lookupGitCollection(connectionId, collectionUuid);
    if (!resolved) {
      return 0;
    }
    return resolved.gitDb.getChangedItemCount(resolved.collection.id);
  }

  /**
   * Stages one request or markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param itemUuid - Stable request or document uuid.
   */
  async stageGitItem(
    connectionId: string,
    collectionUuid: string,
    itemUuid: string
  ): Promise<void> {
    const { gitDb, collection } = await this.resolveGitCollection(connectionId, collectionUuid);
    await gitDb.stageItem(collection.id, itemUuid.trim());
  }

  /**
   * Stages every untracked request and markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @returns Number of items staged.
   */
  async stageAllUntrackedGitItems(connectionId: string, collectionUuid: string): Promise<number> {
    const { gitDb, collection } = await this.resolveGitCollection(connectionId, collectionUuid);
    return gitDb.stageAllUntrackedItems(collection.id);
  }

  /**
   * Unstages one request or markdown document in a git-backed collection.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param itemUuid - Stable request or document uuid.
   */
  async unstageGitItem(
    connectionId: string,
    collectionUuid: string,
    itemUuid: string
  ): Promise<void> {
    const { gitDb, collection } = await this.resolveGitCollection(connectionId, collectionUuid);
    await gitDb.unstageItem(collection.id, itemUuid.trim());
  }

  /**
   * Discards working-tree changes for one request or markdown file path.
   *
   * When `previousPaths` is provided, restores each deleted rename source after
   * reverting the current path so a rename is fully undone.
   *
   * @param connectionId - Git connection id.
   * @param collectionUuid - Stable collection uuid.
   * @param filePath - Repository-relative changed file path.
   * @param previousPaths - Optional deleted paths to restore when reverting a rename.
   */
  async revertGitFile(
    connectionId: string,
    collectionUuid: string,
    filePath: string,
    previousPaths?: string[]
  ): Promise<void> {
    const { gitDb, collection } = await this.resolveGitCollection(connectionId, collectionUuid);

    const trimmedPath = filePath.trim();
    const status = await gitDb.syncManager.getStatus();
    const classified = classifyHarborChangePath(trimmedPath, status.harborSubdir);
    if (classified == null || (classified.kind !== 'request' && classified.kind !== 'document')) {
      throw new Error('Only request and document files can be reverted.');
    }

    const collectionDir = collectionDirName(collection.name);
    if (!isCollectionScopedHarborChange(classified, collectionDir)) {
      throw new Error('File does not belong to this collection.');
    }

    await gitDb.syncManager.revertFile(trimmedPath);

    for (const previousPath of previousPaths ?? []) {
      const trimmedPreviousPath = previousPath.trim();
      if (!trimmedPreviousPath || trimmedPreviousPath === trimmedPath) {
        continue;
      }

      const previousClassified = classifyHarborChangePath(trimmedPreviousPath, status.harborSubdir);
      if (
        previousClassified == null ||
        (previousClassified.kind !== 'request' && previousClassified.kind !== 'document')
      ) {
        continue;
      }
      if (!isCollectionScopedHarborChange(previousClassified, collectionDir)) {
        continue;
      }

      await gitDb.syncManager.revertFile(trimmedPreviousPath);
    }
  }

  /**
   * RoutingStorage aggregates providers; it is not itself source-controlled.
   */
  async getSourceControlStatus(): Promise<null> {
    return null;
  }

  /**
   * Lists all collections from the registry, hydrating data from each provider.
   *
   * When a provider is reachable, registry entries whose collection no longer
   * exists remotely are pruned before results are returned.
   */
  async listCollections(): Promise<Collection[]> {
    this.listCollectionWarnings = [];
    const entries = this.database.listRegistry();

    const recordsByConnection = new Map<string, Map<number, Collection>>();
    const neededConnectionIds = new Set(entries.map((entry) => entry.connectionId));

    for (const connectionId of neededConnectionIds) {
      const backend = this.byConnectionId.get(connectionId);
      if (!backend) {
        this.listCollectionWarnings.push(
          `Could not load collection data: database connection "${connectionId}" is unavailable.`
        );
        continue;
      }
      try {
        if (backend.connectionType === 'team-hub' && backend.db instanceof TeamHubStorage) {
          const hubDb = backend.db;
          if (await hubDb.hasManagementApi()) {
            this.purgeTeamHubSidebarCollections(connectionId, hubDb);
            continue;
          }
        }

        const records = await backend.db.listCollections();
        recordsByConnection.set(
          connectionId,
          new Map(records.map((record) => [record.id, record]))
        );

        const hubDb =
          backend.connectionType === 'team-hub' && backend.db instanceof TeamHubStorage
            ? backend.db
            : undefined;
        this.pruneOrphanRegistryEntries(
          connectionId,
          new Set(records.map((record) => record.id)),
          hubDb,
          backend.connectionName
        );
      } catch (err) {
        console.warn(`Failed to read collections from "${backend.connectionName}":`, err);
        this.listCollectionWarnings.push(
          `Could not load collections from "${backend.connectionName}": ${formatListCollectionError(err)}`
        );
      }
    }

    return this.database.listRegistry().map((entry) => {
      const record = recordsByConnection.get(entry.connectionId)?.get(entry.providerCollectionId);
      return this.buildCollection(entry, record);
    });
  }

  /**
   * Creates a collection in the default data provider and registers it.
   */
  async createCollection(name: string): Promise<Collection> {
    const backend = this.requireDefaultDataBackend();
    return this.createCollectionOnBackend(name, backend);
  }

  /**
   * Creates a collection on a specific provider and registers it.
   *
   * @param name - Display name for the collection.
   * @param connectionId - Target provider connection id (database or team hub).
   */
  async createCollectionInProvider(name: string, connectionId: string): Promise<Collection> {
    const backend = this.requireBackendByConnectionId(connectionId);
    return this.createCollectionOnBackend(name, backend);
  }

  /**
   * Updates a collection's data in its provider and its name in the registry.
   *
   * @param id - Global collection id.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
   * @param userAgent - User-Agent override; empty inherits the global default.
   * @param preRequestScripts - Ordered collection pre-request script references.
   * @param postRequestScripts - Ordered collection post-request script references.
   * @returns The updated global collection.
   */
  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    userAgent: string,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Collection> {
    const entry = this.requireEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const record = await backend.db.updateCollection(
      entry.providerCollectionId,
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      auth,
      userAgent,
      preRequestScripts,
      postRequestScripts
    );
    const updatedEntry = this.database.updateRegistryEntry(id, { name });
    return this.buildCollection(updatedEntry, record);
  }

  /**
   * Updates a collection's sidebar marker in its owning provider.
   *
   * @param id - Global collection id.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated global collection.
   */
  async setCollectionMarker(id: number, marker: string | null): Promise<Collection> {
    const entry = this.requireEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const record = await backend.db.setCollectionMarker(entry.providerCollectionId, marker);
    return this.buildCollection(entry, record);
  }

  /**
   * Deletes a collection from its provider and the registry.
   *
   * Team hub collections marked deletion-locked, or those the token cannot delete
   * on the server, are removed locally only so the server copy stays available.
   */
  async deleteCollection(id: number): Promise<void> {
    await this.deleteCollectionWithMode(id);
  }

  /**
   * Deletes a collection and reports whether it was fully removed or only detached.
   *
   * @param id - Global collection registry id.
   * @returns `'deleted'` when the provider copy was removed, otherwise `'detached'`.
   */
  async deleteCollectionWithMode(id: number): Promise<'deleted' | 'detached'> {
    const entry = this.requireEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);

    if (backend.connectionType === 'team-hub' && backend.db instanceof TeamHubStorage) {
      const hubDb = backend.db;
      const serverCollections = await hubDb.listCollections();
      const record = serverCollections.find((item) => item.id === entry.providerCollectionId);
      if (record?.deletion_locked) {
        this.removeTeamHubCollectionFromSidebar(
          hubDb,
          entry.connectionId,
          entry.providerCollectionId,
          id
        );
        return 'detached';
      }

      try {
        await hubDb.deleteCollection(entry.providerCollectionId);
      } catch (err) {
        if (isTeamHubCollectionDeleteForbiddenError(err)) {
          this.removeTeamHubCollectionFromSidebar(
            hubDb,
            entry.connectionId,
            entry.providerCollectionId,
            id
          );
          return 'detached';
        }
        throw err;
      }

      this.database.deleteRegistryEntry(id);
      return 'deleted';
    }

    await backend.db.deleteCollection(entry.providerCollectionId);
    this.database.deleteRegistryEntry(id);
    return 'deleted';
  }

  /**
   * Removes a hub-backed collection from the local sidebar without deleting it on the server.
   *
   * @param hubDb - Team hub storage backend for the collection.
   * @param hubId - Team hub connection id.
   * @param providerCollectionId - Provider-local collection id.
   * @param registryEntryId - Global registry entry id.
   */
  private removeTeamHubCollectionFromSidebar(
    hubDb: TeamHubStorage,
    hubId: string,
    providerCollectionId: number,
    registryEntryId: number
  ): void {
    const serverId = hubDb.getServerCollectionId(providerCollectionId);
    if (serverId) {
      addDetachedServerId(this.database, hubId, serverId);
    }
    hubDb.forgetLocalCollection(providerCollectionId);
    this.database.deleteRegistryEntry(registryEntryId);
  }

  /**
   * Lists environments from the hidden registry.
   */
  async listEnvironments(): Promise<Environment[]> {
    return this.database.listEnvironments();
  }

  /**
   * Creates an environment in the hidden registry.
   */
  async createEnvironment(name: string, uuid?: string): Promise<Environment> {
    return this.database.createEnvironment(name, uuid);
  }

  /**
   * Updates an environment in the hidden registry.
   */
  async updateEnvironment(
    id: number,
    name: string,
    variables: Variable[],
    parentUuid?: string | null
  ): Promise<Environment> {
    return this.database.updateEnvironment(id, name, variables, parentUuid);
  }

  /**
   * Updates an environment's sidebar marker in the hidden registry.
   *
   * @param id - Environment ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated environment.
   */
  async setEnvironmentMarker(id: number, marker: string | null): Promise<Environment> {
    return this.database.setEnvironmentMarker(id, marker);
  }

  /**
   * Deletes an environment from the hidden registry.
   */
  async deleteEnvironment(id: number): Promise<void> {
    this.database.deleteEnvironment(id);
  }

  /**
   * Deep-copies an environment into a new record in the hidden registry.
   */
  async duplicateEnvironment(id: number): Promise<Environment> {
    return this.database.duplicateEnvironment(id);
  }

  /**
   * Persists a new sidebar order for environments in the hidden registry.
   *
   * @param orderedEnvironmentIds - Environment ids in desired order.
   */
  async reorderEnvironments(orderedEnvironmentIds: number[]): Promise<void> {
    this.database.reorderEnvironments(orderedEnvironmentIds);
  }

  /**
   * Lists requests for a collection, rewriting ids to the global namespace.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const requests = await backend.db.listRequests(entry.providerCollectionId);
    return requests.map((request) => this.toGlobalRequest(request, backend, collectionId));
  }

  /**
   * Saves a request in the backend that owns the target collection.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const entry = this.requireEntry(input.collection_id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localRequestId =
      input.id != null ? this.decodeLocalIdForBackend(input.id, backend) : undefined;
    const localFolderId =
      input.folder_id != null
        ? this.decodeLocalIdForBackend(input.folder_id, backend)
        : input.folder_id;

    const saved = await backend.db.saveRequest({
      ...input,
      id: localRequestId,
      collection_id: entry.providerCollectionId,
      folder_id: localFolderId ?? null
    });
    const globalSaved = this.toGlobalRequest(saved, backend, input.collection_id);

    return globalSaved;
  }

  /**
   * Updates a saved request's sidebar marker in its owning provider.
   *
   * @param id - Global request id.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated request.
   */
  async setRequestMarker(id: number, marker: string | null): Promise<SavedRequest> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const updated = await backend.db.setRequestMarker(localId, marker);
    const entry = this.findEntryForBackendCollection(backend.connectionId, updated.collection_id);
    const globalCollectionId = entry?.id ?? updated.collection_id;
    return this.toGlobalRequest(updated, backend, globalCollectionId);
  }

  /**
   * Deletes a request from the backend identified by its namespaced id.
   */
  async deleteRequest(id: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    await backend.db.deleteRequest(localId);
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  async listFolders(collectionId: number): Promise<Folder[]> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const folders = await backend.db.listFolders(entry.providerCollectionId);
    return folders.map((folder) => this.toGlobalFolder(folder, backend, collectionId));
  }

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @param parentFolderId - Parent folder id, or null/omitted for collection root.
   * @returns The newly created folder.
   */
  async createFolder(
    collectionId: number,
    name: string,
    parentFolderId?: number | null
  ): Promise<Folder> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localParentId =
      parentFolderId != null ? this.decodeLocalIdForBackend(parentFolderId, backend) : null;
    const created = await backend.db.createFolder(entry.providerCollectionId, name, localParentId);
    return this.toGlobalFolder(created, backend, collectionId);
  }

  /**
   * Moves a folder to a new parent and optional sibling index.
   *
   * @param folderId - Global folder id to move.
   * @param parentFolderId - New parent folder id, or null for collection root.
   * @param sortOrder - Optional zero-based index among new siblings.
   * @returns The updated folder.
   */
  async moveFolder(
    folderId: number,
    parentFolderId: number | null,
    sortOrder?: number
  ): Promise<Folder> {
    const { slot, localId } = decodeGlobalId(folderId);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const localParentId = parentFolderId != null ? decodeGlobalId(parentFolderId).localId : null;
    const updated = await backend.db.moveFolder(localId, localParentId, sortOrder);
    const entry = this.findEntryForBackendCollection(backend.connectionId, updated.collection_id);
    const globalCollectionId = entry?.id ?? updated.collection_id;
    return this.toGlobalFolder(updated, backend, globalCollectionId);
  }

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @returns The updated folder.
   */
  async renameFolder(id: number, name: string): Promise<Folder> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const updated = await backend.db.renameFolder(localId, name);
    const entry = this.findEntryForBackendCollection(backend.connectionId, updated.collection_id);
    const globalCollectionId = entry?.id ?? updated.collection_id;
    return this.toGlobalFolder(updated, backend, globalCollectionId);
  }

  /**
   * Updates a folder's name, variables, headers, auth, User-Agent, and scripts.
   *
   * @param id - Folder ID to update.
   * @param name - New display name.
   * @param variables - Folder-scoped variables.
   * @param headers - Headers sent with every request in the folder.
   * @param preRequestScript - Script run before each request in the folder.
   * @param postRequestScript - Script run after each request in the folder.
   * @param auth - Default Authorization settings for requests in the folder.
   * @param userAgent - User-Agent override; empty inherits collection → global.
   * @param preRequestScripts - Ordered folder pre-request script references.
   * @param postRequestScripts - Ordered folder post-request script references.
   * @returns The updated folder.
   */
  async updateFolder(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    userAgent: string,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Folder> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const updated = await backend.db.updateFolder(
      localId,
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      auth,
      userAgent,
      preRequestScripts,
      postRequestScripts
    );
    const entry = this.findEntryForBackendCollection(backend.connectionId, updated.collection_id);
    const globalCollectionId = entry?.id ?? updated.collection_id;
    return this.toGlobalFolder(updated, backend, globalCollectionId);
  }

  /**
   * Updates a folder's sidebar marker in its owning provider.
   *
   * @param id - Global folder id.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated folder.
   */
  async setFolderMarker(id: number, marker: string | null): Promise<Folder> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const updated = await backend.db.setFolderMarker(localId, marker);
    const entry = this.findEntryForBackendCollection(backend.connectionId, updated.collection_id);
    const globalCollectionId = entry?.id ?? updated.collection_id;
    return this.toGlobalFolder(updated, backend, globalCollectionId);
  }

  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    await backend.db.deleteFolder(localId);
  }

  /**
   * Reorders sibling folders that share the same parent within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param parentFolderId - Parent folder id, or null for collection-root siblings.
   * @param orderedFolderIds - Sibling folder IDs in desired order.
   */
  async reorderFolders(
    collectionId: number,
    parentFolderId: number | null,
    orderedFolderIds: number[]
  ): Promise<void> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localParentId =
      parentFolderId != null ? this.decodeLocalIdForBackend(parentFolderId, backend) : null;
    const localIds = orderedFolderIds.map((folderId) =>
      this.decodeLocalIdForBackend(folderId, backend)
    );
    await backend.db.reorderFolders(entry.providerCollectionId, localParentId, localIds);
  }

  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param collectionId - Collection containing the requests.
   * @param folderId - Folder ID, or null for root-level requests.
   * @param orderedRequestIds - Request IDs in desired order.
   */
  async reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localFolderId = folderId != null ? this.decodeLocalIdForBackend(folderId, backend) : null;
    const localRequestIds = orderedRequestIds.map((requestId) =>
      this.decodeLocalIdForBackend(requestId, backend)
    );
    await backend.db.reorderRequests(entry.providerCollectionId, localFolderId, localRequestIds);
  }

  /**
   * Reorders requests and markdown documents together within a folder or collection root.
   */
  async reorderContainerItems(
    collectionId: number,
    folderId: number | null,
    items: ContainerItemRef[]
  ): Promise<void> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localFolderId = folderId != null ? this.decodeLocalIdForBackend(folderId, backend) : null;
    const localItems = items.map((item) => ({
      kind: item.kind,
      id:
        item.kind === 'request'
          ? this.decodeLocalIdForBackend(item.id, backend)
          : this.decodeLocalIdForBackend(item.id, backend)
    }));
    await backend.db.reorderContainerItems(entry.providerCollectionId, localFolderId, localItems);
  }

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(requestId);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const localFolderId = folderId != null ? decodeGlobalId(folderId).localId : null;
    await backend.db.moveRequest(localId, localFolderId, index);
  }

  /**
   * Lists documents for a collection, rewriting ids to the global namespace.
   */
  async listDocuments(collectionId: number): Promise<CollectionDocument[]> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const documents = await backend.db.listDocuments(entry.providerCollectionId);
    return documents.map((document) => this.toGlobalDocument(document, backend, collectionId));
  }

  /**
   * Saves a document in the backend that owns the target collection.
   */
  async saveDocument(input: SaveDocumentInput): Promise<CollectionDocument> {
    const entry = this.requireEntry(input.collection_id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localDocumentId =
      input.id != null ? this.decodeLocalIdForBackend(input.id, backend) : undefined;
    const localFolderId =
      input.folder_id != null
        ? this.decodeLocalIdForBackend(input.folder_id, backend)
        : input.folder_id;

    const saved = await backend.db.saveDocument({
      ...input,
      id: localDocumentId,
      collection_id: entry.providerCollectionId,
      folder_id: localFolderId ?? null
    });
    return this.toGlobalDocument(saved, backend, input.collection_id);
  }

  /**
   * Updates a markdown document's sidebar marker in its owning provider.
   *
   * @param id - Global document id.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated document.
   */
  async setDocumentMarker(id: number, marker: string | null): Promise<CollectionDocument> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const updated = await backend.db.setDocumentMarker(localId, marker);
    const entry = this.findEntryForBackendCollection(backend.connectionId, updated.collection_id);
    const globalCollectionId = entry?.id ?? updated.collection_id;
    return this.toGlobalDocument(updated, backend, globalCollectionId);
  }

  /**
   * Deletes a document from the backend identified by its namespaced id.
   */
  async deleteDocument(id: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    await backend.db.deleteDocument(localId);
  }

  /**
   * Reorders documents within a folder or at collection root.
   */
  async reorderDocuments(
    collectionId: number,
    folderId: number | null,
    orderedDocumentIds: number[]
  ): Promise<void> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localFolderId = folderId != null ? this.decodeLocalIdForBackend(folderId, backend) : null;
    const localDocumentIds = orderedDocumentIds.map((documentId) =>
      this.decodeLocalIdForBackend(documentId, backend)
    );
    await backend.db.reorderDocuments(entry.providerCollectionId, localFolderId, localDocumentIds);
  }

  /**
   * Moves a document to another folder or collection root at a given index.
   */
  async moveDocument(documentId: number, folderId: number | null, index: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(documentId);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const localFolderId = folderId != null ? decodeGlobalId(folderId).localId : null;
    await backend.db.moveDocument(localId, localFolderId, index);
  }

  /**
   * Exports collection data from its owning provider.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const entry = this.requireEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    return backend.db.exportCollectionData(entry.providerCollectionId);
  }

  /**
   * Imports a collection into the default data provider and registers it.
   */
  async importCollectionData(data: unknown): Promise<Collection> {
    const backend = this.requireDefaultDataBackend();
    return this.importCollectionDataToConnection(backend.connectionId, data);
  }

  /**
   * Imports a collection into a specific provider connection and registers it.
   *
   * @param connectionId - Target storage connection id.
   * @param data - Parsed collection export payload.
   * @param displayName - Optional registry display name override.
   * @returns The newly registered global collection.
   */
  async importCollectionDataToConnection(
    connectionId: string,
    data: unknown,
    displayName?: string,
    sourceUrl?: string | null
  ): Promise<Collection> {
    const backend = this.requireBackendByConnectionId(connectionId);
    const imported = await backend.db.importCollectionData(data);
    try {
      const entry = this.database.addRegistryEntry({
        name: displayName?.trim() || imported.name,
        connectionId: backend.connectionId,
        providerCollectionId: imported.id,
        collectionUuid: imported.uuid,
        sourceUrl
      });
      return this.buildCollection(entry, imported);
    } catch (err) {
      await this.compensateProviderCollectionCreate(backend, imported.id);
      throw err;
    }
  }

  /**
   * Looks up a collection by portable uuid via the local registry.
   *
   * @param uuid - Stable collection identifier from an export file.
   * @returns The global collection when registered, otherwise null.
   */
  async findCollectionByUuid(uuid: string): Promise<Collection | null> {
    const entry = this.database.findRegistryEntryByUuid(uuid);
    if (!entry) {
      return null;
    }

    const backend = this.byConnectionId.get(entry.connectionId);
    if (!backend) {
      return this.buildCollection(entry, undefined);
    }

    let record: Collection | undefined;
    try {
      record =
        (await backend.db.findCollectionByUuid(uuid)) ??
        (await backend.db.listCollections()).find((item) => item.id === entry.providerCollectionId);
    } catch (err) {
      console.warn(
        `Failed to read collection uuid "${uuid}" from "${backend.connectionName}":`,
        err
      );
    }

    return this.buildCollection(entry, record);
  }

  /**
   * Looks up a request by uuid within a global collection.
   *
   * @param collectionId - Global collection id.
   * @param uuid - Stable request identifier from an export file.
   * @returns The global request when found, otherwise null.
   */
  async findRequestByUuid(collectionId: number, uuid: string): Promise<SavedRequest | null> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const request = await backend.db.findRequestByUuid(entry.providerCollectionId, uuid);
    if (!request) {
      return null;
    }
    return this.toGlobalRequest(request, backend, collectionId);
  }

  /**
   * Looks up an environment by portable uuid in the local registry.
   *
   * @param uuid - Stable environment identifier from an export file.
   * @returns The environment when found, otherwise undefined.
   */
  findEnvironmentByUuid(uuid: string): Environment | undefined {
    return this.database.findEnvironmentByUuid(uuid);
  }

  /**
   * Updates an existing collection from import data and syncs registry metadata.
   *
   * @param globalCollectionId - Global collection id to update.
   * @param data - Validated collection export payload.
   * @returns The updated global collection.
   */
  async updateCollectionFromImport(
    globalCollectionId: number,
    data: CollectionExport
  ): Promise<Collection> {
    const entry = this.requireEntry(globalCollectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const updated = await backend.db.updateCollectionFromImport(entry.providerCollectionId, data);
    const updatedEntry = this.database.updateRegistryEntry(globalCollectionId, {
      name: updated.name,
      collectionUuid: updated.uuid
    });
    return this.buildCollection(updatedEntry, updated);
  }

  /**
   * Persists the remote import URL for a registry-backed collection.
   *
   * @param globalCollectionId - Global collection id.
   * @param sourceUrl - Absolute URL the collection was imported from, or null to clear.
   * @returns The updated global collection (metadata from the registry entry).
   */
  setCollectionSourceUrl(globalCollectionId: number, sourceUrl: string | null): Collection {
    const updatedEntry = this.database.updateRegistryEntry(globalCollectionId, {
      sourceUrl
    });
    return this.buildCollection(updatedEntry, undefined);
  }

  /**
   * Reads a setting from the hidden registry.
   */
  async getSetting(key: string): Promise<string | undefined> {
    return this.database.getSetting(key);
  }

  /**
   * Persists a setting in the hidden registry.
   */
  async setSetting(key: string, value: string): Promise<void> {
    this.database.setSetting(key, value);
  }

  /**
   * Moves a collection's data to another provider, keeping its global id stable.
   */
  async moveCollection(
    globalCollectionId: number,
    targetConnectionId: string
  ): Promise<Collection> {
    return this.mover.moveCollection(globalCollectionId, targetConnectionId);
  }

  /**
   * Lists routed provider snippets merged with local marketplace snippets.
   */
  async listSnippets(): Promise<Snippet[]> {
    const entries = this.database.listSnippetRegistry();
    const recordsByConnection = new Map<string, Map<number, Snippet>>();

    for (const connectionId of new Set(entries.map((entry) => entry.connectionId))) {
      const backend = this.byConnectionId.get(connectionId);
      if (!backend) {
        continue;
      }
      try {
        const records = await backend.db.listSnippets();
        recordsByConnection.set(
          connectionId,
          new Map(records.map((record) => [record.id, record]))
        );

        const hubDb =
          backend.connectionType === 'team-hub' && backend.db instanceof TeamHubStorage
            ? backend.db
            : undefined;
        this.pruneOrphanSnippetRegistryEntries(
          connectionId,
          new Set(records.map((record) => record.id)),
          hubDb,
          backend.connectionName
        );
      } catch (err) {
        if (isTeamHubSnippetsUnsupportedError(err)) {
          logVerbose(
            `Skipped snippets from "${backend.connectionName}"; server does not expose /snippets.`
          );
          continue;
        }
        console.warn(`Failed to read snippets from "${backend.connectionName}":`, err);
      }
    }

    const routed = entries.map((entry) => {
      const record = recordsByConnection.get(entry.connectionId)?.get(entry.providerSnippetId);
      return this.buildSnippet(entry, record);
    });

    const marketplace = this.database.listMarketplaceSnippets().map((snippet) => ({
      ...snippet,
      id: toMarketplaceSnippetGlobalId(snippet.id)
    }));

    return [...routed, ...marketplace];
  }

  /**
   * Creates a snippet in the default data provider and registers it.
   */
  async createSnippet(
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE,
    uuid?: string
  ): Promise<Snippet> {
    const backend = this.requireDefaultDataBackend();
    return this.createSnippetOnBackend(name, code, scope, stage, backend, uuid);
  }

  /**
   * Creates a snippet on a specific provider and registers it.
   */
  async createSnippetInProvider(
    name: string,
    code: string,
    scope: SnippetScope,
    connectionId: string,
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE,
    uuid?: string
  ): Promise<Snippet> {
    const backend = this.requireBackendByConnectionId(connectionId);
    return this.createSnippetOnBackend(name, code, scope, stage, backend, uuid);
  }

  /**
   * Updates a snippet's data in its provider and registry metadata.
   */
  async updateSnippet(
    id: number,
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE
  ): Promise<Snippet> {
    const marketplaceId = fromMarketplaceSnippetGlobalId(id);
    if (marketplaceId != null) {
      const updated = this.database.updateSnippet(marketplaceId, name, code, scope, stage);
      return { ...updated, id: toMarketplaceSnippetGlobalId(updated.id) };
    }

    const entry = this.requireSnippetEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const record = await backend.db.updateSnippet(
      entry.providerSnippetId,
      name,
      code,
      scope,
      stage
    );
    const updatedEntry = this.database.updateSnippetRegistryEntry(id, {
      name: record.name,
      uuid: record.uuid,
      scope: record.scope
    });
    return this.buildSnippet(updatedEntry, record);
  }

  /**
   * Deletes a routed snippet from its provider and the registry.
   */
  async deleteSnippet(id: number): Promise<void> {
    const marketplaceId = fromMarketplaceSnippetGlobalId(id);
    if (marketplaceId != null) {
      this.database.deleteSnippet(marketplaceId);
      return;
    }

    const entry = this.requireSnippetEntry(id);
    const backend = this.byConnectionId.get(entry.connectionId);
    if (!backend) {
      this.removeSnippetFromLocalRegistry(entry);
      return;
    }

    await backend.db.deleteSnippet(entry.providerSnippetId);
    this.database.deleteSnippetRegistryEntry(id);
  }

  /**
   * Lists live servers from their registered providers using stable registry ids.
   */
  async listLiveServers(): Promise<LiveServer[]> {
    const entries = this.database.listLiveServerRegistry();
    const recordsByConnection = new Map<string, Map<number, LiveServer>>();
    for (const connectionId of new Set(entries.map((entry) => entry.connectionId))) {
      const backend = this.byConnectionId.get(connectionId);
      if (!backend) continue;
      try {
        const records = await backend.db.listLiveServers();
        recordsByConnection.set(
          connectionId,
          new Map(records.map((record) => [record.id, record]))
        );
        this.pruneOrphanLiveServerRegistryEntries(
          connectionId,
          new Set(records.map((record) => record.id)),
          backend.connectionName,
          backend.db instanceof TeamHubStorage ? backend.db : undefined
        );
      } catch (err) {
        console.warn(`Failed to read live servers from "${backend.connectionName}":`, err);
      }
    }
    return entries.flatMap((entry) => {
      const providerRecords = recordsByConnection.get(entry.connectionId);
      const record = providerRecords?.get(entry.providerLiveServerId);
      if (providerRecords && !record) return [];
      return [this.buildLiveServer(entry, record)];
    });
  }

  /**
   * Creates a live server on its requested provider or the default provider.
   *
   * @param input - Portable live-server configuration.
   * @returns Registered live server with a stable global id.
   */
  async createLiveServer(input: CreateLiveServerInput): Promise<LiveServer> {
    if (input.connectionId) {
      return this.createLiveServerInProvider(input.connectionId, input);
    }
    return this.createLiveServerOnBackend(input, this.requireDefaultDataBackend());
  }

  /**
   * Creates a live server on a specific mounted provider.
   *
   * @param connectionId - Destination provider connection id.
   * @param input - Portable live-server configuration.
   * @returns Registered live server with a stable global id.
   */
  async createLiveServerInProvider(
    connectionId: string,
    input: CreateLiveServerInput
  ): Promise<LiveServer> {
    return this.createLiveServerOnBackend(
      { ...input, connectionId: undefined },
      this.requireBackendByConnectionId(connectionId)
    );
  }

  /**
   * Updates shared live-server fields in its provider and local navigation state locally.
   *
   * @param input - Complete mutable live-server fields using the global id.
   * @returns Updated routed live server.
   */
  async updateLiveServer(input: UpdateLiveServerInput): Promise<LiveServer> {
    const entry = this.requireLiveServerEntry(input.id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const record = await backend.db.updateLiveServer({
      ...input,
      id: entry.providerLiveServerId,
      lastOpenedPath: null
    });
    this.database.setLiveServerLocalLastOpenedPath(record.uuid || entry.uuid, input.lastOpenedPath);
    const updatedEntry = this.database.updateLiveServerRegistryEntry(entry.id, {
      name: record.name,
      uuid: record.uuid
    });
    return this.buildLiveServer(updatedEntry, record);
  }

  /**
   * Persists only the machine-local path remembered for a live server.
   *
   * @param id - Stable global live-server id.
   * @param path - Last path opened in the embedded browser, or null.
   */
  setLiveServerLastOpenedPath(id: number, path: string | null): void {
    const entry = this.requireLiveServerEntry(id);
    this.database.setLiveServerLocalLastOpenedPath(entry.uuid, path);
  }

  /**
   * Deletes a routed live server or detaches unavailable Team Hub metadata locally.
   *
   * @param id - Stable global live-server id.
   */
  async deleteLiveServer(id: number): Promise<void> {
    const entry = this.requireLiveServerEntry(id);
    const backend = this.byConnectionId.get(entry.connectionId);
    if (!backend) {
      if (this.isTeamHubConnection(entry.connectionId) && entry.uuid) {
        addDetachedLiveServerId(this.database, entry.connectionId, entry.uuid);
      }
      this.database.deleteLiveServerRegistryEntry(id);
      return;
    }
    await backend.db.deleteLiveServer(entry.providerLiveServerId);
    this.database.deleteLiveServerRegistryEntry(id);
  }

  /**
   * Moves a live server between providers while preserving its global id.
   *
   * @param id - Stable global live-server id.
   * @param targetConnectionId - Destination provider connection id.
   * @returns Moved routed live server.
   */
  async moveLiveServer(id: number, targetConnectionId: string): Promise<LiveServer> {
    return this.liveServerMover.move(id, targetConnectionId);
  }

  /**
   * Lists live pages from their registered providers using stable registry ids.
   */
  async listLivePages(): Promise<Website[]> {
    const entries = this.database.listLivePageRegistry();
    const recordsByConnection = new Map<string, Map<number, Website>>();
    for (const connectionId of new Set(entries.map((entry) => entry.connectionId))) {
      const backend = this.byConnectionId.get(connectionId);
      if (!backend) continue;
      try {
        const records = await backend.db.listLivePages();
        recordsByConnection.set(
          connectionId,
          new Map(records.map((record) => [record.id, record]))
        );
        this.pruneOrphanLivePageRegistryEntries(
          connectionId,
          new Set(records.map((record) => record.id)),
          backend.connectionName,
          backend.db instanceof TeamHubStorage ? backend.db : undefined
        );
      } catch (err) {
        console.warn(`Failed to read live pages from "${backend.connectionName}":`, err);
      }
    }
    return entries.flatMap((entry) => {
      const providerRecords = recordsByConnection.get(entry.connectionId);
      const record = providerRecords?.get(entry.providerLivePageId);
      if (providerRecords && !record) return [];
      return [this.buildLivePage(entry, record)];
    });
  }

  /**
   * Creates a live page on its requested provider or the default provider.
   *
   * @param input - Portable live-page fields.
   * @returns Registered live page with a stable global id.
   */
  async createLivePage(input: CreateWebsiteInput): Promise<Website> {
    if (input.connectionId) {
      return this.createLivePageInProvider(input.connectionId, input);
    }
    return this.createLivePageOnBackend(input, this.requireDefaultDataBackend());
  }

  /**
   * Creates a live page on a specific mounted provider.
   *
   * @param connectionId - Destination provider connection id.
   * @param input - Portable live-page fields.
   * @returns Registered live page with a stable global id.
   */
  async createLivePageInProvider(
    connectionId: string,
    input: CreateWebsiteInput
  ): Promise<Website> {
    return this.createLivePageOnBackend(
      { ...input, connectionId: undefined },
      this.requireBackendByConnectionId(connectionId)
    );
  }

  /**
   * Updates a live page in the provider selected by its registry entry.
   *
   * @param input - Complete mutable fields using the global live-page id.
   * @returns Updated routed live page.
   */
  async updateLivePage(input: UpdateWebsiteInput): Promise<Website> {
    const entry = this.requireLivePageEntry(input.id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const record = await backend.db.updateLivePage({
      ...input,
      id: entry.providerLivePageId
    });
    const updatedEntry = this.database.updateLivePageRegistryEntry(entry.id, {
      name: record.name,
      uuid: record.uuid
    });
    return this.buildLivePage(updatedEntry, record);
  }

  /**
   * Deletes a routed live page or detaches unavailable Team Hub metadata locally.
   *
   * @param id - Stable global live-page id.
   */
  async deleteLivePage(id: number): Promise<void> {
    const entry = this.requireLivePageEntry(id);
    const backend = this.byConnectionId.get(entry.connectionId);
    if (!backend) {
      if (this.isTeamHubConnection(entry.connectionId) && entry.uuid) {
        addDetachedLivePageId(this.database, entry.connectionId, entry.uuid);
      }
      this.database.deleteLivePageRegistryEntry(id);
      return;
    }
    await backend.db.deleteLivePage(entry.providerLivePageId);
    this.database.deleteLivePageRegistryEntry(id);
  }

  /**
   * Moves a live page between providers while preserving its global id.
   *
   * @param id - Stable global live-page id.
   * @param targetConnectionId - Destination provider connection id.
   * @returns Moved routed live page.
   */
  async moveLivePage(id: number, targetConnectionId: string): Promise<Website> {
    return this.livePageMover.move(id, targetConnectionId);
  }

  /**
   * Lists run result snapshots from every mounted provider with global ids.
   */
  async listRunResults(): Promise<SavedRunResultSummary[]> {
    const merged: SavedRunResultSummary[] = [];

    for (const backend of this.byConnectionId.values()) {
      try {
        const records = await backend.db.listRunResults();
        for (const record of records) {
          merged.push({
            ...record,
            id: encodeGlobalId(backend.slot, record.id),
            connectionId: backend.connectionId
          });
        }
      } catch (err) {
        console.warn(`Failed to read run results from "${backend.connectionName}":`, err);
      }
    }

    return merged.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  /**
   * Saves a run result snapshot on the default data provider.
   */
  async saveRunResult(input: SaveRunResultInput): Promise<SavedRunResult>;

  /**
   * Saves a run result snapshot on a specific mounted provider.
   */
  async saveRunResult(connectionId: string, input: SaveRunResultInput): Promise<SavedRunResult>;

  /**
   * Saves a run result snapshot and returns a routed global snapshot row.
   */
  async saveRunResult(
    connectionIdOrInput: string | SaveRunResultInput,
    maybeInput?: SaveRunResultInput
  ): Promise<SavedRunResult> {
    if (typeof connectionIdOrInput === 'string') {
      if (!maybeInput) {
        throw new Error('Run result payload is required.');
      }
      const backend = this.requireBackendByConnectionId(connectionIdOrInput);
      const record = await backend.db.saveRunResult(maybeInput);
      return {
        ...record,
        id: encodeGlobalId(backend.slot, record.id),
        connectionId: backend.connectionId
      };
    }

    const backend = this.requireDefaultDataBackend();
    const record = await backend.db.saveRunResult(connectionIdOrInput);
    return {
      ...record,
      id: encodeGlobalId(backend.slot, record.id),
      connectionId: backend.connectionId
    };
  }

  /**
   * Loads a run result snapshot by routed global id.
   */
  async getRunResult(id: number): Promise<SavedRunResult | null> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      return null;
    }

    const record = await backend.db.getRunResult(localId);
    if (!record) {
      return null;
    }

    return {
      ...record,
      id,
      connectionId: backend.connectionId
    };
  }

  /**
   * Deletes a run result snapshot from the backend identified by its global id.
   */
  async deleteRunResult(id: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    await backend.db.deleteRunResult(localId);
  }

  /**
   * Resolves a run result UUID by probing mounted Team Hub providers.
   *
   * @param uuid - Stable portable run result identifier from a deep link.
   * @returns Routed snapshot when a hub exposes the UUID, otherwise null.
   */
  async resolveRunResultByUuid(uuid: string): Promise<SavedRunResult | null> {
    const trimmedUuid = uuid.trim();
    if (!trimmedUuid) {
      return null;
    }

    for (const backend of this.byConnectionId.values()) {
      if (backend.connectionType !== 'team-hub' || !(backend.db instanceof TeamHubStorage)) {
        continue;
      }

      try {
        const record = await backend.db.fetchRunResultByUuid(trimmedUuid);
        if (!record) {
          continue;
        }

        return {
          ...record,
          id: encodeGlobalId(backend.slot, record.id),
          connectionId: backend.connectionId
        };
      } catch (err) {
        console.warn(`Failed to resolve run result from "${backend.connectionName}":`, err);
      }
    }

    return null;
  }

  /**
   * Removes a snippet from the local registry without contacting its provider.
   *
   * Used when the backing connection is not mounted, for example when a team hub
   * failed its health check during startup.
   *
   * @param entry - Snippet registry row to remove locally.
   */
  private removeSnippetFromLocalRegistry(entry: SnippetRegistryEntry): void {
    const serverSnippetId = this.resolveTeamHubSnippetServerIdForDetach(entry);
    if (serverSnippetId) {
      addDetachedSnippetServerId(this.database, entry.connectionId, serverSnippetId);
      this.forgetTeamHubSnippetIdMapEntry(entry.connectionId, serverSnippetId);
    }

    this.database.deleteSnippetRegistryEntry(entry.id);
  }

  /**
   * Returns true when the connection id belongs to a configured team hub.
   *
   * @param connectionId - Storage or team hub connection id.
   */
  private isTeamHubConnection(connectionId: string): boolean {
    const hubs = parseJson<TeamHub[]>(this.database.getSetting('teamHubs'), []);
    return hubs.some((hub) => hub.id === connectionId);
  }

  /**
   * Resolves a team hub snippet server UUID for local detach bookkeeping.
   *
   * @param entry - Snippet registry row being removed locally.
   * @returns Server snippet UUID when the entry belongs to a team hub.
   */
  private resolveTeamHubSnippetServerIdForDetach(entry: SnippetRegistryEntry): string | undefined {
    if (!this.isTeamHubConnection(entry.connectionId)) {
      return undefined;
    }

    const backend = this.byConnectionId.get(entry.connectionId);
    if (backend?.connectionType === 'team-hub' && backend.db instanceof TeamHubStorage) {
      return backend.db.getServerSnippetId(entry.providerSnippetId);
    }

    const fromMap = this.readTeamHubSnippetServerIdFromIdMap(
      entry.connectionId,
      entry.providerSnippetId
    );
    if (fromMap) {
      return fromMap;
    }

    const uuid = entry.uuid.trim();
    return uuid.length > 0 ? uuid : undefined;
  }

  /**
   * Reads a team hub snippet server UUID from the on-disk id map without mounting the hub.
   *
   * @param hubId - Team hub connection id.
   * @param providerSnippetId - Provider-local snippet id from the registry.
   */
  private readTeamHubSnippetServerIdFromIdMap(
    hubId: string,
    providerSnippetId: number
  ): string | undefined {
    const idMap = new TeamHubIdMap(teamHubIdMapPath(this.userDataPath, hubId));
    try {
      idMap.init();
      return idMap.toServerId('snippet', providerSnippetId);
    } catch {
      return undefined;
    } finally {
      idMap.close();
    }
  }

  /**
   * Removes a team hub snippet mapping from the on-disk id map without mounting the hub.
   *
   * @param hubId - Team hub connection id.
   * @param serverSnippetId - Server-side snippet UUID to forget.
   */
  private forgetTeamHubSnippetIdMapEntry(hubId: string, serverSnippetId: string): void {
    const idMap = new TeamHubIdMap(teamHubIdMapPath(this.userDataPath, hubId));
    try {
      idMap.init();
      idMap.forget('snippet', serverSnippetId);
    } catch {
      // Missing or corrupt id map files are acceptable when dropping local metadata.
    } finally {
      idMap.close();
    }
  }

  /**
   * Moves a snippet's data to another provider, keeping its global id stable.
   */
  async moveSnippet(globalSnippetId: number, targetConnectionId: string): Promise<Snippet> {
    return this.snippetMover.moveSnippet(globalSnippetId, targetConnectionId);
  }

  /**
   * Deep-copies a collection into a new collection on the same backend.
   *
   * @param id - Global collection id to duplicate.
   * @returns The newly created collection with a new global id.
   */
  async duplicateCollection(id: number): Promise<Collection> {
    return this.mover.duplicateCollection(id);
  }

  /**
   * Persists a new sidebar order for collections in the local registry.
   *
   * @param orderedCollectionIds - Global collection ids in desired order.
   */
  async reorderCollections(orderedCollectionIds: number[]): Promise<void> {
    this.database.reorderRegistry(orderedCollectionIds);
  }

  /**
   * Deletes stale source copies left behind by interrupted collection moves.
   */
  async recoverPendingMoveCleanups(): Promise<void> {
    await this.mover.recoverPendingMoveCleanups();
    await this.snippetMover.recoverPendingMoveCleanups();
    await this.liveServerMover.recoverPendingMoveCleanups();
    await this.livePageMover.recoverPendingMoveCleanups();
  }

  /**
   * Returns the sharing metadata for a collection: its owning connection and provider id.
   *
   * @param globalCollectionId - Global (registry) collection id.
   */
  getShareInfo(globalCollectionId: number): {
    connectionId: string;
    name: string;
    providerCollectionId: number;
  } {
    const entry = this.requireEntry(globalCollectionId);
    return {
      connectionId: entry.connectionId,
      name: entry.name,
      providerCollectionId: entry.providerCollectionId
    };
  }

  /**
   * Mounts a shared connection at runtime and registers a single shared collection.
   *
   * @param connection - Connection configuration to mount.
   * @param slot - Backend slot for request id namespacing.
   * @param userDataPath - Electron userData path for SQLite file storage.
   * @param meta - Shared collection name and provider id from the share token.
   * @returns The registered collection.
   */
  async registerSharedCollection(
    connection: StorageConnection,
    slot: number,
    userDataPath: string,
    meta: { name: string; providerCollectionId: number }
  ): Promise<Collection> {
    const alreadyMounted = this.byConnectionId.has(connection.id);
    if (!alreadyMounted) {
      const db = await createStorageInstance(connection, userDataPath);
      this.mount(slot, connection, db);
    }

    const existing = this.database
      .listRegistry()
      .find(
        (entry) =>
          entry.connectionId === connection.id &&
          entry.providerCollectionId === meta.providerCollectionId
      );

    const backend = this.requireBackendByConnectionId(connection.id);
    let record: Collection | undefined;
    try {
      const records = await backend.db.listCollections();
      record = records.find((item) => item.id === meta.providerCollectionId);
    } catch (err) {
      console.warn(`Failed to read collections from "${backend.connectionName}":`, err);
      this.listCollectionWarnings.push(
        `Could not load collections from "${backend.connectionName}": ${formatListCollectionError(err)}`
      );
    }

    const entry =
      existing ??
      this.database.addRegistryEntry({
        name: meta.name,
        connectionId: connection.id,
        providerCollectionId: meta.providerCollectionId,
        collectionUuid: record?.uuid ?? ''
      });

    return this.buildCollection(entry, record);
  }

  /**
   * Backfills the registry from existing provider data on first run.
   *
   * @param legacyProviderDbPath - Path to the user SQLite provider file for legacy registry migration.
   */
  async migrateRegistryIfNeeded(legacyProviderDbPath: string): Promise<void> {
    return this.migrator.migrateRegistryIfNeeded(legacyProviderDbPath);
  }

  /**
   * Creates and mounts every configured connection and team hub, skipping failures gracefully.
   */
  static async create(
    database: LocalDatabase,
    preferredConnectionId: string,
    connections: StorageConnection[],
    teamHubs: TeamHub[],
    slots: Record<string, number>,
    userDataPath: string
  ): Promise<RoutingStorage> {
    const defaultDataConnectionId = RoutingStorage.resolveDefaultConnectionId(
      preferredConnectionId,
      connections
    );
    const router = new RoutingStorage(database, defaultDataConnectionId, userDataPath);

    for (const connection of connections) {
      const slot = slots[connection.id];
      if (slot === undefined) continue;

      if (!isStorageConnectionConfigured(connection)) {
        console.warn(
          `Skipping database "${connection.name}" (${connection.type}): settings are incomplete`
        );
        continue;
      }

      try {
        const db = await createStorageInstance(connection, userDataPath);
        router.mount(slot, connection, db);
      } catch (err) {
        console.warn(
          `Failed to initialize database "${connection.name}" (${connection.type}):`,
          err
        );
      }
    }

    for (const hub of teamHubs) {
      const slot = slots[hub.id];
      if (slot === undefined) continue;

      try {
        await router.mountTeamHub(hub, slot);
      } catch (err) {
        logVerbose('team-hub:mount-failed', { hubId: hub.id, name: hub.name, err });
      }
    }

    if (!router.hasDefaultProvider()) {
      const fallback = [...router.byConnectionId.values()].find(
        (backend) => backend.connectionType === 'sqlite'
      );
      if (fallback) {
        router.setDefaultDataConnectionId(fallback.connectionId);
      } else {
        const first = router.byConnectionId.values().next().value;
        if (first) {
          router.setDefaultDataConnectionId(first.connectionId);
        }
      }
    }

    await router.recoverPendingMoveCleanups();

    for (const hub of teamHubs) {
      if (!router.byConnectionId.has(hub.id)) continue;
      try {
        await router.syncTeamHub(hub.id);
      } catch (err) {
        console.warn(`Failed to sync collections from team hub "${hub.name}":`, err);
      }
    }

    void refreshTeamHubPluginSources().catch((err) => {
      console.warn('Failed to refresh Team Hub plugin sources:', err);
    });

    for (const connection of connections) {
      if (connection.type !== 'git' || !router.byConnectionId.has(connection.id)) {
        continue;
      }
      if (connection.collectionDiscoverySkipped) {
        continue;
      }
      try {
        await router.reconcileGitRegistry(connection.id);
      } catch (err) {
        console.warn(`Failed to reconcile git collections for "${connection.name}":`, err);
      }
    }

    return router;
  }

  /**
   * Mounts or remounts a team hub backend at runtime.
   *
   * @param hub - Team hub connection settings.
   * @param slot - Backend slot for request id namespacing.
   */
  async mountTeamHub(hub: TeamHub, slot: number): Promise<void> {
    const existing = this.byConnectionId.get(hub.id);
    if (existing) {
      await existing.db.close();
      this.byConnectionId.delete(hub.id);
      this.bySlot.delete(existing.slot);
    }

    const db = await createTeamHubStorage(hub, this.userDataPath);
    this.mount(slot, { id: hub.id, name: hub.name, type: 'team-hub' }, db, hub.baseUrl);
  }

  /**
   * Mounts or remounts a database connection backend at runtime (for example after
   * saving git settings before restart).
   *
   * @param connection - Saved database connection configuration.
   * @param options - Optional mount behavior overrides.
   */
  async mountStorageConnection(
    connection: StorageConnection,
    options: { reconcileGit?: boolean } = {}
  ): Promise<void> {
    if (!isStorageConnectionConfigured(connection)) {
      return;
    }

    const slot = getSlotForConnection(connection.id);
    if (slot === undefined) {
      console.warn(
        `No slot assigned for database "${connection.name}" (${connection.id}); skipping mount.`
      );
      return;
    }

    const existing = this.byConnectionId.get(connection.id);
    if (existing) {
      await existing.db.close();
      this.byConnectionId.delete(connection.id);
      this.bySlot.delete(existing.slot);
    }

    const db = await createStorageInstance(connection, this.userDataPath);
    this.mount(slot, { id: connection.id, name: connection.name, type: connection.type }, db);

    const reconcileGit = options.reconcileGit ?? true;
    if (connection.type === 'git' && reconcileGit) {
      await this.reconcileGitRegistry(connection.id);
    }
  }

  /**
   * Lists collections on a mounted provider that are not yet registered in the sidebar.
   *
   * @param connectionId - Storage connection id to scan.
   * @returns Provider collections missing from the local registry.
   */
  async listUnregisteredCollections(connectionId: string): Promise<DiscoveredCollection[]> {
    const backend = this.requireBackendByConnectionId(connectionId);
    const records = await this.listProviderCollections(backend);
    const registered = new Set(
      this.database
        .listRegistry()
        .filter((entry) => entry.connectionId === connectionId)
        .map((entry) => entry.providerCollectionId)
    );

    return records
      .filter((record) => !registered.has(record.id))
      .map((record) => ({
        providerCollectionId: record.id,
        name: record.name,
        uuid: record.uuid
      }));
  }

  /**
   * Registers selected provider collections in the sidebar registry.
   *
   * @param connectionId - Storage connection id that owns the collections.
   * @param providerCollectionIds - Provider-local collection ids to add.
   * @returns Number of collections added to the registry.
   */
  async registerDiscoveredCollections(
    connectionId: string,
    providerCollectionIds: readonly number[]
  ): Promise<number> {
    const backend = this.requireBackendByConnectionId(connectionId);
    const records = await this.listProviderCollections(backend);
    const byId = new Map(records.map((record) => [record.id, record]));
    const registered = new Set(
      this.database
        .listRegistry()
        .filter((entry) => entry.connectionId === connectionId)
        .map((entry) => entry.providerCollectionId)
    );

    let added = 0;
    for (const providerCollectionId of providerCollectionIds) {
      if (registered.has(providerCollectionId)) continue;
      const record = byId.get(providerCollectionId);
      if (!record) continue;

      this.database.addRegistryEntry({
        name: record.name,
        connectionId,
        providerCollectionId: record.id,
        collectionUuid: record.uuid
      });
      registered.add(providerCollectionId);
      added += 1;
    }

    return added;
  }

  /**
   * Reads collections from a mounted provider, reloading git working trees first.
   *
   * @param backend - Mounted provider backend.
   * @returns Collections stored on the provider.
   */
  private async listProviderCollections(backend: MountedBackend): Promise<Collection[]> {
    if (backend.connectionType === 'git' && backend.db instanceof GitStorage) {
      await backend.db.reloadFromDisk();
    }
    return backend.db.listCollections();
  }

  /**
   * Re-reads collection data from a single provider.
   *
   * Team hubs run additive registry sync first; all provider types then
   * list collections to validate connectivity and pull fresh metadata.
   *
   * @param connectionId - Database connection or team hub id.
   * @throws When the provider is not mounted.
   */
  async syncProvider(connectionId: string): Promise<void> {
    const backend = this.byConnectionId.get(connectionId);
    if (!backend) {
      throw new Error(`Provider "${connectionId}" is not mounted.`);
    }
    if (backend.connectionType === 'team-hub') {
      await this.syncTeamHub(connectionId);
    }
    if (backend.connectionType === 'git') {
      const gitDb = this.requireGitStorageFromBackend(backend);
      await gitDb.reloadFromDisk();
      await this.reconcileGitRegistry(connectionId);
      return;
    }
    const records = await backend.db.listCollections();
    this.pruneOrphanRegistryEntries(
      connectionId,
      new Set(records.map((record) => record.id)),
      undefined,
      backend.connectionName
    );
  }

  /**
   * Syncs registry entries with collections discovered in a git working tree.
   *
   * @param connectionId - Git connection id.
   */
  async reconcileGitRegistry(connectionId: string): Promise<void> {
    const backend = this.requireBackendByConnectionId(connectionId);
    if (backend.connectionType !== 'git') {
      throw new Error(`Connection "${connectionId}" is not a git provider.`);
    }

    const gitDb = this.requireGitStorageFromBackend(backend);
    const collections = await gitDb.listCollections();
    const entries = this.database
      .listRegistry()
      .filter((entry) => entry.connectionId === connectionId);
    const byProviderId = new Map(entries.map((entry) => [entry.providerCollectionId, entry]));
    const onDiskIds = new Set(collections.map((collection) => collection.id));

    for (const collection of collections) {
      const existing = byProviderId.get(collection.id);
      if (!existing) {
        this.database.addRegistryEntry({
          name: collection.name,
          connectionId,
          providerCollectionId: collection.id,
          collectionUuid: collection.uuid
        });
        continue;
      }
      if (existing.collectionUuid !== collection.uuid || existing.name !== collection.name) {
        this.database.updateRegistryEntry(existing.id, {
          name: collection.name,
          collectionUuid: collection.uuid
        });
      }
    }

    for (const entry of entries) {
      if (!onDiskIds.has(entry.providerCollectionId)) {
        this.database.deleteRegistryEntry(entry.id);
      }
    }
  }

  /**
   * Returns the git database backend or throws when the connection is not git-backed.
   *
   * @param connectionId - Git connection id.
   */
  requireGitStorage(connectionId: string): GitStorage {
    const backend = this.requireBackendByConnectionId(connectionId);
    return this.requireGitStorageFromBackend(backend);
  }

  /**
   * Returns the git database backend or throws when the connection is not git-backed.
   *
   * @param backend - Mounted backend descriptor.
   */
  private requireGitStorageFromBackend(backend: MountedBackend): GitStorage {
    if (backend.connectionType !== 'git' || !(backend.db instanceof GitStorage)) {
      throw new Error(`Connection "${backend.connectionId}" is not a git provider.`);
    }
    return backend.db;
  }

  /**
   * Adds registry entries for server collections not yet registered on a hub.
   *
   * @param hubId - Team hub connection id.
   */
  async syncTeamHub(hubId: string): Promise<void> {
    const backend = this.requireBackendByConnectionId(hubId);
    if (backend.connectionType !== 'team-hub') {
      throw new Error(`Connection "${hubId}" is not a team hub.`);
    }

    const hubDb = backend.db;
    if (!(hubDb instanceof TeamHubStorage)) {
      throw new Error(`Team hub backend for "${hubId}" is unavailable.`);
    }

    if (await hubDb.hasManagementApi()) {
      this.purgeTeamHubSidebarCollections(hubId, hubDb);
      logVerbose(
        `Skipped collection sync for admin team hub "${backend.connectionName}"; sidebar entries were cleared.`
      );
      return;
    }

    const detached = readDetachedServerIds(this.database, hubId);
    const serverCollections = await hubDb.listCollections();
    const entries = this.database.listRegistry().filter((entry) => entry.connectionId === hubId);
    const registeredProviderIds = new Set(entries.map((entry) => entry.providerCollectionId));

    for (const record of serverCollections) {
      const serverId = hubDb.getServerCollectionId(record.id);
      if (!serverId) continue;

      if (detached.has(serverId)) continue;
      if (registeredProviderIds.has(record.id)) continue;

      this.database.addRegistryEntry({
        name: record.name,
        connectionId: hubId,
        providerCollectionId: record.id,
        collectionUuid: record.uuid
      });
    }

    this.pruneOrphanRegistryEntries(
      hubId,
      new Set(serverCollections.map((record) => record.id)),
      hubDb,
      backend.connectionName
    );

    await this.syncTeamHubSnippets(hubId, hubDb, backend.connectionName);
    await this.syncTeamHubLiveServers(hubId, hubDb, backend.connectionName);
    await this.syncTeamHubLivePages(hubId, hubDb, backend.connectionName);
  }

  /**
   * Adds registry entries for server snippets not yet registered on a hub.
   *
   * @param hubId - Team hub connection id.
   * @param hubDb - Mounted team hub storage backend.
   * @param connectionName - Display name used in verbose logs.
   */
  private async syncTeamHubSnippets(
    hubId: string,
    hubDb: TeamHubStorage,
    connectionName: string
  ): Promise<void> {
    if (await hubDb.hasManagementApi()) {
      return;
    }

    const detached = readDetachedSnippetServerIds(this.database, hubId);
    let serverSnippets: Snippet[];
    try {
      serverSnippets = await hubDb.listSnippets();
    } catch (err) {
      if (isTeamHubSnippetsUnsupportedError(err)) {
        console.warn(
          `Team hub "${connectionName}" does not respond to /snippets; snippet sync skipped. Confirm the hub server URL and version include snippet storage.`
        );
        return;
      }
      throw err;
    }
    const entries = this.database
      .listSnippetRegistry()
      .filter((entry) => entry.connectionId === hubId);
    const registeredProviderIds = new Set(entries.map((entry) => entry.providerSnippetId));

    for (const record of serverSnippets) {
      const serverId = hubDb.getServerSnippetId(record.id);
      if (!serverId) continue;

      if (detached.has(serverId)) continue;
      if (registeredProviderIds.has(record.id)) continue;

      this.database.addSnippetRegistryEntry({
        name: record.name,
        connectionId: hubId,
        providerSnippetId: record.id,
        uuid: record.uuid,
        scope: record.scope
      });
    }

    this.pruneOrphanSnippetRegistryEntries(
      hubId,
      new Set(serverSnippets.map((record) => record.id)),
      hubDb,
      connectionName
    );
  }

  /**
   * Adds Team Hub live servers that are not registered or intentionally detached.
   *
   * @param hubId - Team Hub connection id.
   * @param hubDb - Mounted Team Hub storage.
   * @param connectionName - Display name for diagnostics.
   */
  private async syncTeamHubLiveServers(
    hubId: string,
    hubDb: TeamHubStorage,
    connectionName: string
  ): Promise<void> {
    const records = await (hubDb as IStorage).listLiveServers();
    const detached = readDetachedLiveServerIds(this.database, hubId);
    const entries = this.database
      .listLiveServerRegistry()
      .filter((entry) => entry.connectionId === hubId);
    const registered = new Set(entries.map((entry) => entry.providerLiveServerId));
    for (const record of records) {
      if (detached.has(record.uuid) || registered.has(record.id)) continue;
      this.database.addLiveServerRegistryEntry({
        name: record.name,
        uuid: record.uuid,
        connectionId: hubId,
        providerLiveServerId: record.id
      });
    }
    this.pruneOrphanLiveServerRegistryEntries(
      hubId,
      new Set(records.map((record) => record.id)),
      connectionName,
      hubDb
    );
  }

  /**
   * Adds Team Hub live pages that are not registered or intentionally detached.
   *
   * @param hubId - Team Hub connection id.
   * @param hubDb - Mounted Team Hub storage.
   * @param connectionName - Display name for diagnostics.
   */
  private async syncTeamHubLivePages(
    hubId: string,
    hubDb: TeamHubStorage,
    connectionName: string
  ): Promise<void> {
    const records = await (hubDb as IStorage).listLivePages();
    const detached = readDetachedLivePageIds(this.database, hubId);
    const entries = this.database
      .listLivePageRegistry()
      .filter((entry) => entry.connectionId === hubId);
    const registered = new Set(entries.map((entry) => entry.providerLivePageId));
    for (const record of records) {
      if (detached.has(record.uuid) || registered.has(record.id)) continue;
      this.database.addLivePageRegistryEntry({
        name: record.name,
        uuid: record.uuid,
        connectionId: hubId,
        providerLivePageId: record.id
      });
    }
    this.pruneOrphanLivePageRegistryEntries(
      hubId,
      new Set(records.map((record) => record.id)),
      connectionName,
      hubDb
    );
  }

  /**
   * Removes registry entries for a connection when their provider collection id
   * is absent from a successful remote listing.
   *
   * @param connectionId - Database or team hub connection id.
   * @param remoteProviderIds - Provider-local collection ids returned by the remote store.
   * @param hubDb - Team hub backend when pruning hub-backed entries (clears id map entries).
   * @param connectionName - Display name used in verbose logs.
   */
  private pruneOrphanRegistryEntries(
    connectionId: string,
    remoteProviderIds: ReadonlySet<number>,
    hubDb: TeamHubStorage | undefined,
    connectionName: string
  ): void {
    const entries = this.database
      .listRegistry()
      .filter((entry) => entry.connectionId === connectionId);

    for (const entry of entries) {
      if (remoteProviderIds.has(entry.providerCollectionId)) continue;

      hubDb?.forgetLocalCollection(entry.providerCollectionId);
      this.database.deleteRegistryEntry(entry.id);
      logVerbose(
        `Removed registry entry for collection "${entry.name}" on "${connectionName}" because it no longer exists on the remote provider.`
      );
    }
  }

  /**
   * Removes snippet registry entries when their provider snippet id is absent remotely.
   */
  private pruneOrphanSnippetRegistryEntries(
    connectionId: string,
    remoteProviderIds: ReadonlySet<number>,
    hubDb: TeamHubStorage | undefined,
    connectionName: string
  ): void {
    const entries = this.database
      .listSnippetRegistry()
      .filter((entry) => entry.connectionId === connectionId);

    for (const entry of entries) {
      if (remoteProviderIds.has(entry.providerSnippetId)) continue;

      hubDb?.forgetLocalSnippet(entry.providerSnippetId);
      this.database.deleteSnippetRegistryEntry(entry.id);
      logVerbose(
        `Removed registry entry for snippet "${entry.name}" on "${connectionName}" because it no longer exists on the remote provider.`
      );
    }
  }

  /**
   * Removes live-server registry rows whose provider record disappeared.
   *
   * @param connectionId - Provider connection id.
   * @param providerIds - Provider-local ids returned by a successful listing.
   * @param connectionName - Provider display name for diagnostics.
   * @param hubDb - Team Hub backend used to clear stale id mappings.
   */
  private pruneOrphanLiveServerRegistryEntries(
    connectionId: string,
    providerIds: ReadonlySet<number>,
    connectionName: string,
    hubDb?: TeamHubStorage
  ): void {
    for (const entry of this.database.listLiveServerRegistry()) {
      if (entry.connectionId !== connectionId || providerIds.has(entry.providerLiveServerId)) {
        continue;
      }
      hubDb?.forgetLocalLiveServer(entry.providerLiveServerId);
      this.database.deleteLiveServerRegistryEntry(entry.id);
      logVerbose(
        `Removed registry entry for live server "${entry.name}" on "${connectionName}" because it no longer exists on the provider.`
      );
    }
  }

  /**
   * Removes live-page registry rows whose provider record disappeared.
   *
   * @param connectionId - Provider connection id.
   * @param providerIds - Provider-local ids returned by a successful listing.
   * @param connectionName - Provider display name for diagnostics.
   * @param hubDb - Team Hub backend used to clear stale id mappings.
   */
  private pruneOrphanLivePageRegistryEntries(
    connectionId: string,
    providerIds: ReadonlySet<number>,
    connectionName: string,
    hubDb?: TeamHubStorage
  ): void {
    for (const entry of this.database.listLivePageRegistry()) {
      if (entry.connectionId !== connectionId || providerIds.has(entry.providerLivePageId)) {
        continue;
      }
      hubDb?.forgetLocalLivePage(entry.providerLivePageId);
      this.database.deleteLivePageRegistryEntry(entry.id);
      logVerbose(
        `Removed registry entry for live page "${entry.name}" on "${connectionName}" because it no longer exists on the provider.`
      );
    }
  }

  /**
   * Removes all sidebar registry entries for a team hub without deleting server data.
   *
   * @param hubId - Team hub connection id.
   * @param hubDb - Team hub storage backend for the connection, when still mounted.
   */
  private purgeTeamHubSidebarCollections(hubId: string, hubDb?: TeamHubStorage): void {
    for (const entry of this.database.listRegistry()) {
      if (entry.connectionId !== hubId) continue;
      hubDb?.forgetLocalCollection(entry.providerCollectionId);
      this.database.deleteRegistryEntry(entry.id);
    }
  }

  /**
   * Removes all snippet registry entries for a team hub without deleting server data.
   *
   * @param hubId - Team hub connection id.
   * @param hubDb - Team hub storage backend for the connection, when still mounted.
   */
  private purgeTeamHubSidebarSnippets(hubId: string, hubDb?: TeamHubStorage): void {
    for (const entry of this.database.listSnippetRegistry()) {
      if (entry.connectionId !== hubId) continue;
      hubDb?.forgetLocalSnippet(entry.providerSnippetId);
      this.database.deleteSnippetRegistryEntry(entry.id);
    }
  }

  /**
   * Removes live-server registry rows for a disconnected Team Hub.
   *
   * @param hubId - Team Hub connection id.
   */
  private purgeTeamHubSidebarLiveServers(hubId: string): void {
    for (const entry of this.database.listLiveServerRegistry()) {
      if (entry.connectionId === hubId) this.database.deleteLiveServerRegistryEntry(entry.id);
    }
  }

  /**
   * Removes live-page registry rows for a disconnected Team Hub.
   *
   * @param hubId - Team Hub connection id.
   */
  private purgeTeamHubSidebarLivePages(hubId: string): void {
    for (const entry of this.database.listLivePageRegistry()) {
      if (entry.connectionId === hubId) this.database.deleteLivePageRegistryEntry(entry.id);
    }
  }

  /**
   * Soft-disconnects a team hub: unmounts the backend and purges sidebar registry
   * entries while preserving the id map file and detached-collection settings so
   * reconnect can remount without reconfiguring the hub.
   *
   * Registry rows are removed without calling `forgetLocal*` so the on-disk id
   * map stays intact for the next mount.
   *
   * @param hubId - Team hub connection id.
   */
  async disconnectTeamHub(hubId: string): Promise<void> {
    const backend = this.byConnectionId.get(hubId);
    if (backend) {
      await backend.db.close();
      this.byConnectionId.delete(hubId);
      this.bySlot.delete(backend.slot);
    }

    this.purgeTeamHubSidebarCollections(hubId);
    this.purgeTeamHubSidebarSnippets(hubId);
    this.purgeTeamHubSidebarLiveServers(hubId);
    this.purgeTeamHubSidebarLivePages(hubId);
  }

  /**
   * Unmounts a team hub, removes its registry entries, and deletes its id map file.
   *
   * @param hubId - Team hub connection id.
   */
  async removeTeamHub(hubId: string): Promise<void> {
    const backend = this.byConnectionId.get(hubId);
    if (backend) {
      await backend.db.close();
      this.byConnectionId.delete(hubId);
      this.bySlot.delete(backend.slot);
    }

    for (const entry of this.database.listRegistry()) {
      if (entry.connectionId === hubId) {
        this.database.deleteRegistryEntry(entry.id);
      }
    }

    for (const entry of this.database.listSnippetRegistry()) {
      if (entry.connectionId === hubId) {
        this.database.deleteSnippetRegistryEntry(entry.id);
      }
    }

    this.purgeTeamHubSidebarLiveServers(hubId);
    this.purgeTeamHubSidebarLivePages(hubId);

    removeDetachedSetting(this.database, hubId);
    removeDetachedLiveServerSetting(this.database, hubId);
    removeDetachedLivePageSetting(this.database, hubId);

    try {
      unlinkSync(teamHubIdMapPath(this.userDataPath, hubId));
    } catch {
      // Missing id map file is acceptable when mount never succeeded.
    }
  }

  private static resolveDefaultConnectionId(
    preferredConnectionId: string,
    connections: StorageConnection[]
  ): string {
    const preferred = connections.find((conn) => conn.id === preferredConnectionId);
    if (preferred) {
      return preferredConnectionId;
    }

    const sqlite = connections.find((conn) => conn.type === 'sqlite');
    if (sqlite) {
      return sqlite.id;
    }

    return connections[0]?.id ?? preferredConnectionId;
  }

  /**
   * Creates a collection on a backend and registers it in the local registry.
   *
   * @param name - Display name for the collection.
   * @param backend - Mounted provider that should store collection data.
   */
  private async createCollectionOnBackend(
    name: string,
    backend: MountedBackend
  ): Promise<Collection> {
    const created = await backend.db.createCollection(name);
    try {
      const entry = this.database.addRegistryEntry({
        name: created.name,
        connectionId: backend.connectionId,
        providerCollectionId: created.id,
        collectionUuid: created.uuid
      });
      return this.buildCollection(entry, created);
    } catch (err) {
      await this.compensateProviderCollectionCreate(backend, created.id);
      throw err;
    }
  }

  /**
   * Deletes a provider collection when registry registration fails after create/import.
   *
   * @param backend - Backend that owns the orphaned provider collection.
   * @param providerCollectionId - Provider-local collection id to remove.
   */
  private async compensateProviderCollectionCreate(
    backend: MountedBackend,
    providerCollectionId: number
  ): Promise<void> {
    try {
      await backend.db.deleteCollection(providerCollectionId);
    } catch (cleanupErr) {
      console.warn(
        `Failed to clean up provider collection ${providerCollectionId} after registry failure:`,
        cleanupErr
      );
    }
  }

  /**
   * Merges registry metadata with backend collection record fields.
   *
   * @param entry - Registry entry for the collection.
   * @param record - Optional backend collection record.
   * @returns Combined Collection for the renderer.
   */
  private buildCollection(
    entry: CollectionRegistryEntry,
    record: Collection | undefined
  ): Collection {
    const recordUuid = record?.uuid?.trim() ?? '';
    const entryUuid = entry.collectionUuid.trim();
    const uuid = recordUuid || entryUuid;

    if (recordUuid && recordUuid !== entryUuid) {
      this.database.updateRegistryEntry(entry.id, { collectionUuid: recordUuid });
    }

    return {
      id: entry.id,
      uuid,
      name: entry.name,
      variables: record?.variables ?? [],
      headers: record?.headers ?? [],
      userAgent: record?.userAgent ?? '',
      auth: record?.auth ?? defaultAuth(),
      pre_request_script: record?.pre_request_script ?? '',
      post_request_script: record?.post_request_script ?? '',
      pre_request_scripts: record?.pre_request_scripts ?? [],
      post_request_scripts: record?.post_request_scripts ?? [],
      created_at: record?.created_at ?? entry.created_at,
      deletion_locked: record?.deletion_locked,
      marker: record?.marker ?? null,
      archived: entry.archived,
      connectionId: entry.connectionId,
      sourceUrl: entry.sourceUrl ?? null
    };
  }

  /**
   * Merges snippet registry metadata with backend snippet record fields.
   */
  private buildSnippet(entry: SnippetRegistryEntry, record: Snippet | undefined): Snippet {
    const recordUuid = record?.uuid?.trim() ?? '';
    const entryUuid = entry.uuid.trim();
    const uuid = recordUuid || entryUuid;

    if (recordUuid && recordUuid !== entryUuid) {
      this.database.updateSnippetRegistryEntry(entry.id, { uuid: recordUuid });
    }

    return {
      id: entry.id,
      uuid,
      name: entry.name,
      code: record?.code ?? '',
      scope: record?.scope ?? entry.scope,
      stage: record?.stage ?? DEFAULT_SCRIPT_STAGE,
      source: 'local',
      connectionId: entry.connectionId,
      created_at: record?.created_at ?? entry.created_at,
      updated_at: record?.updated_at ?? entry.created_at
    };
  }

  /**
   * Merges live-server registry identity with provider fields and local navigation state.
   *
   * @param entry - Stable routing registry entry.
   * @param record - Provider-local live-server record when available.
   * @returns Routed live server using the registry id.
   */
  private buildLiveServer(
    entry: LiveServerRegistryEntry,
    record: LiveServer | undefined
  ): LiveServer {
    const fields = normalizeLiveServerConfigFields(record);
    const uuid = record?.uuid?.trim() || entry.uuid;
    if (record?.uuid && record.uuid !== entry.uuid) {
      this.database.updateLiveServerRegistryEntry(entry.id, { uuid: record.uuid });
    }
    return {
      id: entry.id,
      uuid,
      name: entry.name,
      root: record?.root ?? '',
      port: record?.port ?? null,
      aliases: record?.aliases ?? [],
      watch: record?.watch ?? true,
      cors: normalizeLiveServerCorsSettings(record?.cors),
      ...fields,
      lastOpenedPath: this.database.getLiveServerLocalLastOpenedPath(uuid),
      sortOrder: record?.sortOrder ?? 0,
      connectionId: entry.connectionId,
      createdAt: record?.createdAt ?? Date.parse(entry.created_at),
      updatedAt: record?.updatedAt ?? Date.parse(entry.created_at)
    };
  }

  /**
   * Merges live-page registry identity with provider fields.
   *
   * @param entry - Stable routing registry entry.
   * @param record - Provider-local live-page record when available.
   * @returns Routed live page using the registry id.
   */
  private buildLivePage(entry: LivePageRegistryEntry, record: Website | undefined): Website {
    const uuid = record?.uuid?.trim() || entry.uuid;
    if (record?.uuid && record.uuid !== entry.uuid) {
      this.database.updateLivePageRegistryEntry(entry.id, { uuid: record.uuid });
    }
    const createdAt = record?.createdAt ?? Date.parse(entry.created_at);
    return {
      id: entry.id,
      uuid,
      name: entry.name,
      url: record?.url ?? 'about:blank',
      homeUrl: record?.homeUrl ?? 'about:blank',
      faviconDataUrl: record?.faviconDataUrl ?? null,
      scripts: record?.scripts ?? [],
      preRequestScripts: record?.preRequestScripts ?? [],
      postRequestScripts: record?.postRequestScripts ?? [],
      variables: record?.variables ?? [],
      headers: record?.headers ?? [],
      userAgent: record?.userAgent ?? '',
      auth: record?.auth ?? defaultAuth(),
      connectionId: entry.connectionId,
      createdAt,
      updatedAt: record?.updatedAt ?? createdAt
    };
  }

  /**
   * Creates and registers a live server, compensating provider writes on registry failure.
   *
   * @param input - Portable live-server fields.
   * @param backend - Destination provider.
   * @returns Routed live server.
   */
  private async createLiveServerOnBackend(
    input: CreateLiveServerInput,
    backend: MountedBackend
  ): Promise<LiveServer> {
    let created: LiveServer;
    try {
      created = await backend.db.createLiveServer({
        ...input,
        connectionId: undefined,
        lastOpenedPath: null
      });
    } catch (err) {
      rethrowTeamHubLiveServerCreateError(backend, err);
    }
    try {
      const entry = this.database.addLiveServerRegistryEntry({
        name: created.name,
        uuid: created.uuid,
        connectionId: backend.connectionId,
        providerLiveServerId: created.id
      });
      if (input.lastOpenedPath != null) {
        this.database.setLiveServerLocalLastOpenedPath(created.uuid, input.lastOpenedPath);
      }
      return this.buildLiveServer(entry, created);
    } catch (err) {
      try {
        await backend.db.deleteLiveServer(created.id);
      } catch (cleanupErr) {
        console.warn('Failed to compensate live-server create after registry failure:', cleanupErr);
      }
      throw err;
    }
  }

  /**
   * Creates and registers a live page, compensating provider writes on registry failure.
   *
   * @param input - Portable live-page fields.
   * @param backend - Destination provider.
   * @returns Routed live page.
   */
  private async createLivePageOnBackend(
    input: CreateWebsiteInput,
    backend: MountedBackend
  ): Promise<Website> {
    let created: Website;
    try {
      created = await backend.db.createLivePage({ ...input, connectionId: undefined });
    } catch (err) {
      rethrowTeamHubLivePageCreateError(backend, err);
    }
    try {
      const entry = this.database.addLivePageRegistryEntry({
        name: created.name,
        uuid: created.uuid,
        connectionId: backend.connectionId,
        providerLivePageId: created.id
      });
      return this.buildLivePage(entry, created);
    } catch (err) {
      try {
        await backend.db.deleteLivePage(created.id);
      } catch (cleanupErr) {
        console.warn('Failed to compensate live-page create after registry failure:', cleanupErr);
      }
      throw err;
    }
  }

  /**
   * Creates a snippet on a backend and registers it in the local registry.
   */
  private async createSnippetOnBackend(
    name: string,
    code: string,
    scope: SnippetScope,
    stage: ScriptStage,
    backend: MountedBackend,
    uuid?: string
  ): Promise<Snippet> {
    const created = await backend.db.createSnippet(name, code, scope, stage, uuid);
    try {
      const entry = this.database.addSnippetRegistryEntry({
        name: created.name,
        connectionId: backend.connectionId,
        providerSnippetId: created.id,
        uuid: created.uuid,
        scope: created.scope
      });
      return this.buildSnippet(entry, created);
    } catch (err) {
      await this.compensateProviderSnippetCreate(backend, created.id);
      throw err;
    }
  }

  /**
   * Deletes a provider snippet when registry registration fails after create.
   */
  private async compensateProviderSnippetCreate(
    backend: MountedBackend,
    providerSnippetId: number
  ): Promise<void> {
    try {
      await backend.db.deleteSnippet(providerSnippetId);
    } catch (cleanupErr) {
      console.warn(
        `Failed to clean up provider snippet ${providerSnippetId} after registry failure:`,
        cleanupErr
      );
    }
  }

  /**
   * Encodes backend-scoped request ids into global ids for the UI.
   *
   * @param request - Backend-scoped saved request.
   * @param backend - Mounted backend that owns the request.
   * @param globalCollectionId - Encoded global collection id.
   * @returns Request with global ids.
   */
  private toGlobalRequest(
    request: SavedRequest,
    backend: MountedBackend,
    globalCollectionId: number
  ): SavedRequest {
    return {
      ...request,
      id: encodeGlobalId(backend.slot, request.id),
      collection_id: globalCollectionId,
      folder_id: request.folder_id != null ? encodeGlobalId(backend.slot, request.folder_id) : null
    };
  }

  /**
   * Encodes backend-scoped folder ids into global ids for the UI.
   *
   * @param folder - Backend-scoped folder.
   * @param backend - Mounted backend that owns the folder.
   * @param globalCollectionId - Encoded global collection id.
   * @returns Folder with global ids.
   */
  private toGlobalFolder(
    folder: Folder,
    backend: MountedBackend,
    globalCollectionId: number
  ): Folder {
    return {
      ...folder,
      id: encodeGlobalId(backend.slot, folder.id),
      collection_id: globalCollectionId,
      parent_folder_id:
        folder.parent_folder_id != null
          ? encodeGlobalId(backend.slot, folder.parent_folder_id)
          : null
    };
  }

  /**
   * Encodes backend-scoped document ids into global ids for the UI.
   *
   * @param document - Backend-scoped collection document.
   * @param backend - Mounted backend that owns the document.
   * @param globalCollectionId - Encoded global collection id.
   * @returns Document with global ids.
   */
  private toGlobalDocument(
    document: CollectionDocument,
    backend: MountedBackend,
    globalCollectionId: number
  ): CollectionDocument {
    return {
      ...document,
      id: encodeGlobalId(backend.slot, document.id),
      collection_id: globalCollectionId,
      folder_id:
        document.folder_id != null ? encodeGlobalId(backend.slot, document.folder_id) : null
    };
  }

  /**
   * Decodes a global id and verifies it belongs to the expected backend slot.
   *
   * @param globalId - Namespaced id from the UI.
   * @param backend - Mounted backend that should own the id.
   * @returns Local id within that backend.
   * @throws When the id's slot does not match the backend.
   */
  private decodeLocalIdForBackend(globalId: number, backend: MountedBackend): number {
    const { slot, localId } = decodeGlobalId(globalId);
    if (slot !== backend.slot) {
      throw new Error(
        `Global id ${globalId} does not belong to backend slot ${backend.slot} (slot ${slot}).`
      );
    }
    return localId;
  }

  /**
   * Resolves the registry entry for a provider-scoped collection id.
   *
   * @param connectionId - Backend connection id.
   * @param providerCollectionId - Collection id within that backend.
   * @returns Matching registry entry, or undefined.
   */
  private findEntryForBackendCollection(
    connectionId: string,
    providerCollectionId: number
  ): CollectionRegistryEntry | undefined {
    return this.database
      .listRegistry()
      .find(
        (entry) =>
          entry.connectionId === connectionId && entry.providerCollectionId === providerCollectionId
      );
  }

  /**
   * Chooses the default mounted backend for new collections.
   *
   * @returns The preferred or first available backend.
   * @throws When no backend is mounted.
   */
  private resolveDefaultDataBackend(): MountedBackend {
    if (this.byConnectionId.has(this.defaultDataConnectionId)) {
      return this.requireBackendByConnectionId(this.defaultDataConnectionId);
    }

    const sqlite = [...this.byConnectionId.values()].find(
      (backend) => backend.connectionType === 'sqlite'
    );
    if (sqlite) return sqlite;

    const first = this.byConnectionId.values().next().value;
    if (!first) {
      throw new Error('No database provider is available.');
    }
    return first;
  }

  /**
   * Returns the configured default data backend or throws.
   *
   * @returns The default mounted backend.
   * @throws When the default connection is unavailable.
   */
  private requireDefaultDataBackend(): MountedBackend {
    const backend = this.byConnectionId.get(this.defaultDataConnectionId);
    if (!backend) {
      throw new Error('Default database provider is unavailable.');
    }
    return backend;
  }

  /**
   * Returns a mounted backend by connection id or throws.
   *
   * @param connectionId - Connection id to resolve.
   * @returns The mounted backend.
   * @throws When the connection is unavailable.
   */
  private requireBackendByConnectionId(connectionId: string): MountedBackend {
    const backend = this.byConnectionId.get(connectionId);
    if (!backend) {
      throw new Error(`Database connection "${connectionId}" is unavailable.`);
    }
    return backend;
  }

  /**
   * Returns a registry entry by global id or throws.
   *
   * @param id - Global collection id.
   * @returns The registry entry.
   * @throws When the entry does not exist.
   */
  private requireEntry(id: number): CollectionRegistryEntry {
    const entry = this.database.getRegistryEntry(id);
    if (!entry) {
      throw new Error(`Collection not found: ${id}`);
    }
    return entry;
  }

  /**
   * Returns a snippet registry entry by global id or throws.
   */
  private requireSnippetEntry(id: number): SnippetRegistryEntry {
    const entry = this.database.getSnippetRegistryEntry(id);
    if (!entry) {
      throw new Error(`Snippet not found: ${id}`);
    }
    return entry;
  }

  /**
   * Returns a live-server registry entry by global id or throws.
   *
   * @param id - Stable global live-server id.
   * @returns Matching routing entry.
   */
  private requireLiveServerEntry(id: number): LiveServerRegistryEntry {
    const entry = this.database.getLiveServerRegistryEntry(id);
    if (!entry) throw new Error(`Live server not found: ${id}`);
    return entry;
  }

  /**
   * Returns a live-page registry entry by global id or throws.
   *
   * @param id - Stable global live-page id.
   * @returns Matching routing entry.
   */
  private requireLivePageEntry(id: number): LivePageRegistryEntry {
    const entry = this.database.getLivePageRegistryEntry(id);
    if (!entry) throw new Error(`Live page not found: ${id}`);
    return entry;
  }

  /**
   * Builds the internal context object passed to move and migration helpers.
   *
   * @returns RoutingInternals with bound accessors to this router's private state.
   */
  private createInternals(): RoutingInternals {
    return {
      database: this.database,
      getBackend: (connectionId) => this.byConnectionId.get(connectionId),
      listBackends: () => [...this.byConnectionId.values()],
      requireBackendByConnectionId: (connectionId) =>
        this.requireBackendByConnectionId(connectionId),
      requireDefaultDataBackend: () => this.requireDefaultDataBackend(),
      resolveDefaultDataBackend: () => this.resolveDefaultDataBackend(),
      requireEntry: (id) => this.requireEntry(id),
      buildCollection: (entry, record) => this.buildCollection(entry, record),
      resolveCollectionServerId: (connectionId, providerCollectionId) => {
        const backend = this.byConnectionId.get(connectionId);
        if (!backend || backend.connectionType !== 'team-hub') {
          return undefined;
        }
        if (!(backend.db instanceof TeamHubStorage)) {
          return undefined;
        }
        return backend.db.getServerCollectionId(providerCollectionId);
      },
      addDetachedTeamHubCollection: (hubId, serverCollectionId) => {
        addDetachedServerId(this.database, hubId, serverCollectionId);
      }
    };
  }
}
