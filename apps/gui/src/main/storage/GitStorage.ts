import { rmSync } from 'fs';
import { join, relative } from 'path';
import {
  assignGitId,
  loadGitIdIndex,
  pruneGitIdMap,
  saveGitIdIndex,
  type GitIdIndexData
} from '#/main/git/idIndex';
import {
  buildExistingRequestFileMap,
  COLLECTION_MANIFEST_FILE,
  collectionDirPath,
  collectionManifestPath,
  createStoredFolder,
  deleteEnvironmentFile,
  deleteLivePageFile,
  deleteLiveServerFile,
  deleteSnippetFile,
  ensureHarborclientLayout,
  listCollectionFoldersOnDisk,
  readAllEnvironments,
  readAllLivePages,
  readAllLiveServers,
  readAllSnippets,
  assertDocumentFilenameAvailable,
  isCollectionRequestOrDocumentFile,
  readCollectionFromFolder,
  readGitProviderSettings,
  readStoredDocumentRefs,
  resolveHarborclientRoot,
  writeCollectionToFolder,
  writeEnvironmentFile,
  writeGitProviderSettings,
  writeLivePageFile,
  writeLiveServerFile,
  writeSnippetFile,
  type StoredFolderRow
} from '#/main/git/fileLayout';
import { deriveRequestFileStatus, isCountedCollectionChange } from '#/main/git/gitRequestStatus';
import { GitSyncManager } from '#/main/git/GitSyncManager';
import { maskVariablesForExport, validateCollectionExport } from './collectionData';
import { trimRequiredName } from './trimRequiredName';
import {
  assertFolderSiblingReorder,
  assertValidFolderParent,
  folderSubtreeIdsForDeletion,
  maxSiblingFolderSortOrder,
  sortExportedFoldersParentFirst,
  wouldCreateFolderCycle
} from './folderStorage';
import { assertContainerItemOrder, planContainerItemMove } from './containerReorder';
import type { ContainerItemRef } from '@harborclient/core/collectionContainerOrder';
import type { IStorage } from './IStorage';
import type {
  ProviderRunResult,
  ProviderRunResultSummary,
  SaveRunResultInput
} from '@harborclient/core/collectionRunner';
import { generateDocumentUuid, resolveImportUuid } from './uuid';
import {
  buildDocumentUuidIndex,
  buildFolderImportMaps,
  buildRequestFingerprintIndexes,
  buildRequestUuidIndex,
  importedFolderToStoredRow,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportRequestId,
  resolveImportedFolderParentId,
  resolveUpsertRequestFolderId,
  serializeImportedCollectionScriptFields,
  serializeImportedDocumentFields,
  serializeImportedRequestFields
} from './collectionImport';
import { serializeSidebarMarker } from './sidebarMarkerMigration';
import { buildLiveServerExport } from '@harborclient/core/types/liveServer';
import {
  findMatchingRuntime,
  normalizeRuntimeRequirement,
  runtimeRequirementFor
} from '@harborclient/core/types/runtime';
import { listRuntimes } from '#/main/settings/runtimeSettings';
import { buildWebsiteExport } from '@harborclient/core/types/website';
import {
  liveServerFromPayload,
  parseLiveServerPayload,
  serializeLiveServerPayload
} from '@harborclient/storage-sqlite/liveServerPayload';
import {
  livePageFromPayload,
  parseLivePagePayload,
  serializeLivePagePayload
} from '@harborclient/storage-sqlite/livePagePayload';
import { defaultAuth, normalizeAuth } from '@harborclient/core/auth';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExport,
  CreateLiveServerInput,
  CreateWebsiteInput,
  Environment,
  EnvironmentExport,
  ExportedDocument,
  ExportedRequest,
  Folder,
  GitSettings,
  GitRequestFileStatus,
  KeyValue,
  LiveServer,
  LiveServerExport,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  SnippetExport,
  SourceControlStatus,
  UpdateLiveServerInput,
  UpdateWebsiteInput,
  Variable,
  Website,
  WebsiteExport
} from '@harborclient/core/types';
import type { SnippetScope } from '@harborclient/core/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '@harborclient/core/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';

/**
 * Collection metadata held in memory for one git-backed collection file.
 */
type GitStoredManifest = {
  harborclientVersion: 1;
  harborclientExport: 'collection';
  uuid: string;
  name: string;
  marker?: string | null;
  variables: Variable[];
  headers: KeyValue[];
  userAgent: string;
  auth?: AuthConfig;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ScriptRef[];
  post_request_scripts: ScriptRef[];
  folders: StoredFolderRow[];
  created_at: string;
};

interface LoadedCollection {
  /**
   * Absolute path to the collection folder on disk.
   */
  dirPath: string;

  /**
   * Parsed collection manifest.
   */
  manifest: GitStoredManifest;

  /**
   * Request export rows for this collection.
   */
  requests: ExportedRequest[];

  /**
   * Markdown document rows for this collection.
   */
  documents: ExportedDocument[];
}

/**
 * Builds a validated collection export payload from loaded git collection state.
 *
 * @param loaded - In-memory collection state.
 */
function buildCollectionExportFromLoaded(loaded: LoadedCollection): CollectionExport {
  return validateCollectionExport({
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: loaded.manifest.uuid,
    name: loaded.manifest.name,
    marker: loaded.manifest.marker ?? null,
    variables: loaded.manifest.variables,
    headers: loaded.manifest.headers,
    userAgent: loaded.manifest.userAgent ?? '',
    auth: loaded.manifest.auth,
    pre_request_script: loaded.manifest.pre_request_script,
    post_request_script: loaded.manifest.post_request_script,
    pre_request_scripts: loaded.manifest.pre_request_scripts,
    post_request_scripts: loaded.manifest.post_request_scripts,
    folders: loaded.manifest.folders.map((folder) => ({
      uuid: folder.uuid,
      name: folder.name,
      parent_folder_uuid: folder.parent_uuid ?? null,
      sort_order: folder.sort_order,
      variables: folder.variables ?? [],
      headers: folder.headers ?? [],
      userAgent: folder.userAgent ?? '',
      auth: folder.auth ?? defaultAuth(),
      pre_request_script: folder.pre_request_script ?? '',
      post_request_script: folder.post_request_script ?? '',
      pre_request_scripts: folder.pre_request_scripts ?? [],
      post_request_scripts: folder.post_request_scripts ?? [],
      marker: folder.marker ?? null
    })),
    requests: loaded.requests,
    documents: loaded.documents
  });
}

/**
 * Git-backed IStorage implementation storing collections as files in a repository.
 */
export class GitStorage implements IStorage {
  readonly #connectionId: string;
  readonly #userDataPath: string;
  readonly #root: string;
  readonly #sync: GitSyncManager;
  readonly #isAutoTrackEnabled: () => boolean;
  #idIndex: GitIdIndexData;
  #collections = new Map<number, LoadedCollection>();
  #environments = new Map<number, EnvironmentExport>();
  #snippets = new Map<number, SnippetExport>();
  #liveServers = new Map<number, LiveServerExport>();
  #livePages = new Map<number, WebsiteExport>();
  #liveServerTimestamps = new Map<string, { createdAt: number; updatedAt: number }>();
  #livePageTimestamps = new Map<string, { createdAt: number; updatedAt: number }>();
  #requestTimestamps = new Map<string, { created_at: string; updated_at: string }>();
  #documentTimestamps = new Map<string, { created_at: string; updated_at: string }>();
  #providerSettings: Record<string, string> = {};
  #initialized = false;
  /**
   * Harbor-root document paths removed from a collection since the last commit,
   * keyed by provider-local collection id. Needed so deletions outside the
   * collection folder prefix can still be staged on commit.
   */
  #pendingHarborDocumentPaths = new Map<number, Set<string>>();

  /**
   * @param connectionId - Git connection id for auth and id index persistence.
   * @param settings - Git connection settings.
   * @param userDataPath - Electron userData path for id index and provider settings.
   * @param isAutoTrackEnabled - Returns whether newly created requests/documents
   *   should be staged with git immediately (the "Auto track" setting). Defaults
   *   to disabled so unit tests observe untracked files unless they opt in.
   */
  constructor(
    connectionId: string,
    settings: GitSettings,
    userDataPath: string,
    isAutoTrackEnabled: () => boolean = () => false
  ) {
    this.#connectionId = connectionId;
    this.#userDataPath = userDataPath;
    this.#root = resolveHarborclientRoot(settings.repoPath, settings.subdir);
    this.#sync = new GitSyncManager(connectionId, settings);
    this.#idIndex = loadGitIdIndex(userDataPath, connectionId);
    this.#isAutoTrackEnabled = isAutoTrackEnabled;
  }

  /**
   * Stages a newly created request/document (and its collection manifest) so it
   * is tracked by git the moment it is added, when Auto track is enabled.
   *
   * Failures are logged and swallowed so a git problem never blocks persisting
   * the item itself.
   *
   * @param collectionId - Provider-local collection id owning the new item.
   * @param itemUuid - Stable uuid of the newly created request or document.
   */
  private async autoTrackNewItem(collectionId: number, itemUuid: string): Promise<void> {
    if (!this.#isAutoTrackEnabled()) {
      return;
    }
    const loaded = this.requireCollection(collectionId);
    const paths = [
      this.toRepoRelativePath(collectionManifestPath(loaded.dirPath)),
      this.getItemRepoPath(collectionId, itemUuid)
    ];
    for (const path of paths) {
      try {
        await this.#sync.stageFile(path);
      } catch (error) {
        console.error(`Failed to auto-track "${path}" for git:`, error);
      }
    }
  }

  /**
   * Exposes the sync manager for IPC git operations.
   */
  get syncManager(): GitSyncManager {
    return this.#sync;
  }

  /**
   * Reloads collections and environments from disk, reconciling the id index.
   */
  async reloadFromDisk(): Promise<void> {
    this.#collections.clear();
    this.#environments.clear();
    this.#snippets.clear();
    this.#liveServers.clear();
    this.#livePages.clear();
    ensureHarborclientLayout(this.#root);

    const collectionUuids = new Set<string>();
    for (const entry of listCollectionFoldersOnDisk(this.#root)) {
      collectionUuids.add(entry.uuid);
      const { manifest, requests, documents } = this.loadCollectionFromFolder(entry.dirPath);
      const collectionId = assignGitId(
        this.#idIndex,
        'collectionIds',
        'nextCollectionId',
        manifest.uuid
      );
      this.#collections.set(collectionId, {
        dirPath: entry.dirPath,
        manifest,
        requests,
        documents
      });

      const folderUuids = new Set<string>();
      for (const folder of manifest.folders) {
        folderUuids.add(folder.uuid);
        assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', folder.uuid);
      }
      pruneGitIdMap(this.#idIndex, 'folderIds', folderUuids);

      const requestUuids = new Set<string>();
      for (const request of requests) {
        const requestUuid = resolveImportUuid(request.uuid);
        requestUuids.add(requestUuid);
        assignGitId(this.#idIndex, 'requestIds', 'nextRequestId', requestUuid);
        if (!this.#requestTimestamps.has(requestUuid)) {
          const now = new Date().toISOString();
          this.#requestTimestamps.set(requestUuid, { created_at: now, updated_at: now });
        }
      }
      pruneGitIdMap(this.#idIndex, 'requestIds', requestUuids);

      const documentUuids = new Set<string>();
      for (const document of documents) {
        const documentUuid = resolveImportUuid(document.uuid);
        documentUuids.add(documentUuid);
        assignGitId(this.#idIndex, 'documentIds', 'nextDocumentId', documentUuid);
        if (!this.#documentTimestamps.has(documentUuid)) {
          const now = new Date().toISOString();
          this.#documentTimestamps.set(documentUuid, { created_at: now, updated_at: now });
        }
      }
      pruneGitIdMap(this.#idIndex, 'documentIds', documentUuids);
    }
    pruneGitIdMap(this.#idIndex, 'collectionIds', collectionUuids);

    const envUuids = new Set<string>();
    for (const env of readAllEnvironments(this.#root)) {
      const envUuid = resolveImportUuid(env.uuid);
      envUuids.add(envUuid);
      const envId = assignGitId(this.#idIndex, 'environmentIds', 'nextEnvironmentId', envUuid);
      this.#environments.set(envId, { ...env, uuid: envUuid });
    }
    pruneGitIdMap(this.#idIndex, 'environmentIds', envUuids);

    const snippetUuids = new Set<string>();
    for (const snippet of readAllSnippets(this.#root)) {
      const snippetUuid = resolveImportUuid(snippet.uuid);
      snippetUuids.add(snippetUuid);
      const snippetId = assignGitId(this.#idIndex, 'snippetIds', 'nextSnippetId', snippetUuid);
      this.#snippets.set(snippetId, { ...snippet, uuid: snippetUuid });
    }
    pruneGitIdMap(this.#idIndex, 'snippetIds', snippetUuids);

    const liveServerUuids = new Set<string>();
    for (const server of readAllLiveServers(this.#root)) {
      const uuid = resolveImportUuid(server.uuid);
      liveServerUuids.add(uuid);
      const id = assignGitId(this.#idIndex, 'liveServerIds', 'nextLiveServerId', uuid);
      this.#liveServers.set(id, { ...server, uuid });
      if (!this.#liveServerTimestamps.has(uuid)) {
        const now = Date.now();
        this.#liveServerTimestamps.set(uuid, { createdAt: now, updatedAt: now });
      }
    }
    pruneGitIdMap(this.#idIndex, 'liveServerIds', liveServerUuids);

    const livePageUuids = new Set<string>();
    for (const page of readAllLivePages(this.#root)) {
      const uuid = resolveImportUuid(page.uuid);
      livePageUuids.add(uuid);
      const id = assignGitId(this.#idIndex, 'livePageIds', 'nextLivePageId', uuid);
      this.#livePages.set(id, { ...page, uuid });
      if (!this.#livePageTimestamps.has(uuid)) {
        const now = Date.now();
        this.#livePageTimestamps.set(uuid, { createdAt: now, updatedAt: now });
      }
    }
    pruneGitIdMap(this.#idIndex, 'livePageIds', livePageUuids);

    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
  }

  /**
   * Opens the git-backed store and loads data from the working tree.
   */
  async init(): Promise<void> {
    if (this.#initialized) {
      return;
    }
    this.#providerSettings = readGitProviderSettings(this.#userDataPath, this.#connectionId);
    await this.reloadFromDisk();
    this.#initialized = true;
  }

  /**
   * @inheritdoc
   */
  async listCollections(): Promise<Collection[]> {
    const collections = [...this.#collections.entries()]
      .map(([id, loaded]) => this.manifestToCollection(id, loaded.manifest))
      .sort((a, b) => a.name.localeCompare(b.name));
    return collections;
  }

  /**
   * @inheritdoc
   */
  async createCollection(name: string): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const uuid = generateDocumentUuid();
    const manifest: GitStoredManifest = {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid,
      name: trimmedName,
      variables: [],
      headers: [],
      userAgent: '',
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      folders: [],
      created_at: new Date().toISOString()
    };
    const dirPath = writeCollectionToFolder(
      this.#root,
      buildCollectionExportFromLoaded({
        dirPath: collectionDirPath(this.#root, trimmedName),
        manifest,
        requests: [],
        documents: []
      })
    );
    const id = assignGitId(this.#idIndex, 'collectionIds', 'nextCollectionId', uuid);
    this.#collections.set(id, { dirPath, manifest, requests: [], documents: [] });
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    await this.stageCollectionManifest(dirPath);
    return this.manifestToCollection(id, manifest);
  }

  /**
   * Stages `collection.json` for a collection directory so the manifest is
   * tracked as soon as the collection exists on disk.
   *
   * Failures are logged and swallowed so a git problem never blocks creating
   * the collection itself.
   *
   * @param dirPath - Absolute path to the collection folder on disk.
   */
  private async stageCollectionManifest(dirPath: string): Promise<void> {
    const manifestRepoPath = this.toRepoRelativePath(collectionManifestPath(dirPath));
    try {
      await this.#sync.stageFile(manifestRepoPath);
    } catch (error) {
      console.error(`Failed to stage collection manifest "${manifestRepoPath}" for git:`, error);
    }
  }

  /**
   * @inheritdoc
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
    const loaded = this.requireCollection(id);
    const trimmedName = trimRequiredName(name, 'Collection name');
    loaded.manifest = {
      ...loaded.manifest,
      name: trimmedName,
      variables,
      headers,
      userAgent,
      auth: normalizeAuth(auth),
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: preRequestScripts,
      post_request_scripts: postRequestScripts
    };

    this.persistCollection(id);
    return this.manifestToCollection(id, loaded.manifest);
  }

  /**
   * @inheritdoc
   */
  async setCollectionMarker(id: number, marker: string | null): Promise<Collection> {
    const loaded = this.requireCollection(id);
    loaded.manifest = {
      ...loaded.manifest,
      marker: serializeSidebarMarker(marker)
    };
    this.persistCollection(id);
    return this.manifestToCollection(id, loaded.manifest);
  }

  /**
   * @inheritdoc
   */
  async deleteCollection(id: number): Promise<void> {
    const loaded = this.requireCollection(id);
    for (const request of loaded.requests) {
      delete this.#idIndex.requestIds[resolveImportUuid(request.uuid)];
      this.#requestTimestamps.delete(resolveImportUuid(request.uuid));
    }
    for (const document of loaded.documents) {
      delete this.#idIndex.documentIds[resolveImportUuid(document.uuid)];
      this.#documentTimestamps.delete(resolveImportUuid(document.uuid));
    }
    for (const folder of loaded.manifest.folders) {
      delete this.#idIndex.folderIds[folder.uuid];
    }
    delete this.#idIndex.collectionIds[loaded.manifest.uuid];
    rmSync(loaded.dirPath, { recursive: true, force: true });
    this.#collections.delete(id);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
  }

  /**
   * @inheritdoc
   */
  async listEnvironments(): Promise<Environment[]> {
    return [...this.#environments.entries()]
      .map(([id, env]) => this.exportToEnvironment(id, env))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * @inheritdoc
   */
  async createEnvironment(name: string, uuid?: string): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const environmentUuid = uuid?.trim() || generateDocumentUuid();
    const exportData: EnvironmentExport = {
      harborclientVersion: 1,
      harborclientExport: 'environment',
      uuid: environmentUuid,
      name: trimmedName,
      variables: []
    };
    writeEnvironmentFile(this.#root, exportData);
    const id = assignGitId(this.#idIndex, 'environmentIds', 'nextEnvironmentId', environmentUuid);
    this.#environments.set(id, exportData);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.exportToEnvironment(id, exportData);
  }

  /**
   * @inheritdoc
   */
  async updateEnvironment(
    id: number,
    name: string,
    variables: Variable[],
    parentUuid?: string | null
  ): Promise<Environment> {
    const existing = this.#environments.get(id);
    if (!existing) {
      throw new Error('Environment not found');
    }
    const trimmedName = trimRequiredName(name, 'Environment name');
    const updated: EnvironmentExport = {
      ...existing,
      name: trimmedName,
      variables,
      ...(parentUuid === undefined ? {} : { parentUuid: parentUuid?.trim() || null })
    };
    deleteEnvironmentFile(this.#root, updated.uuid!);
    writeEnvironmentFile(this.#root, updated);
    this.#environments.set(id, updated);
    return this.exportToEnvironment(id, updated);
  }

  /**
   * @inheritdoc
   */
  async setEnvironmentMarker(id: number, marker: string | null): Promise<Environment> {
    const existing = this.#environments.get(id);
    if (!existing) {
      throw new Error('Environment not found');
    }
    const updated: EnvironmentExport = {
      ...existing,
      marker: serializeSidebarMarker(marker)
    };
    deleteEnvironmentFile(this.#root, updated.uuid!);
    writeEnvironmentFile(this.#root, updated);
    this.#environments.set(id, updated);
    return this.exportToEnvironment(id, updated);
  }

  /**
   * @inheritdoc
   */
  async deleteEnvironment(id: number): Promise<void> {
    const existing = this.#environments.get(id);
    if (!existing) {
      throw new Error('Environment not found');
    }
    const deletedUuid = resolveImportUuid(existing.uuid);
    for (const [childId, child] of this.#environments) {
      if (child.parentUuid === deletedUuid) {
        const updated: EnvironmentExport = { ...child, parentUuid: null };
        deleteEnvironmentFile(this.#root, updated.uuid!);
        writeEnvironmentFile(this.#root, updated);
        this.#environments.set(childId, updated);
      }
    }
    deleteEnvironmentFile(this.#root, deletedUuid);
    delete this.#idIndex.environmentIds[deletedUuid];
    this.#environments.delete(id);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
  }

  /**
   * @inheritdoc
   */
  async listSnippets(): Promise<Snippet[]> {
    return [...this.#snippets.entries()]
      .map(([id, snippet]) => this.exportToSnippet(id, snippet))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * @inheritdoc
   */
  async createSnippet(
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE,
    uuid?: string
  ): Promise<Snippet> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const snippetUuid = uuid?.trim() || generateDocumentUuid();
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    const exportData: SnippetExport = {
      harborclientVersion: 1,
      harborclientExport: 'snippet',
      uuid: snippetUuid,
      name: trimmedName,
      code: code ?? '',
      scope,
      stage: normalizedRole,
      created_at: now,
      updated_at: now
    };
    writeSnippetFile(this.#root, exportData);
    const id = assignGitId(this.#idIndex, 'snippetIds', 'nextSnippetId', snippetUuid);
    this.#snippets.set(id, exportData);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.exportToSnippet(id, exportData);
  }

  /**
   * @inheritdoc
   */
  async updateSnippet(
    id: number,
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE
  ): Promise<Snippet> {
    const existing = this.#snippets.get(id);
    if (!existing) {
      throw new Error('Snippet not found');
    }
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    const updated: SnippetExport = {
      ...existing,
      name: trimmedName,
      code: code ?? '',
      scope,
      stage: normalizedRole,
      updated_at: now
    };
    deleteSnippetFile(this.#root, resolveImportUuid(existing.uuid));
    writeSnippetFile(this.#root, updated);
    this.#snippets.set(id, updated);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.exportToSnippet(id, updated);
  }

  /**
   * @inheritdoc
   */
  async deleteSnippet(id: number): Promise<void> {
    const existing = this.#snippets.get(id);
    if (!existing) {
      throw new Error('Snippet not found');
    }
    deleteSnippetFile(this.#root, resolveImportUuid(existing.uuid));
    delete this.#idIndex.snippetIds[resolveImportUuid(existing.uuid)];
    this.#snippets.delete(id);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
  }

  /**
   * @inheritdoc
   */
  async listLiveServers(): Promise<LiveServer[]> {
    return [...this.#liveServers.entries()]
      .map(([id, server]) => this.exportToLiveServer(id, server))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  /**
   * @inheritdoc
   */
  async createLiveServer(input: CreateLiveServerInput): Promise<LiveServer> {
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const uuid = input.uuid?.trim() || generateDocumentUuid();
    const payload = parseLiveServerPayload(serializeLiveServerPayload(input));
    const { runtimeId, ...exportFields } = payload;
    const matchedRuntime =
      runtimeId !== '' ? listRuntimes().find((runtime) => runtime.id === runtimeId) : undefined;
    const exportData = buildLiveServerExport({
      uuid,
      name,
      ...exportFields,
      runtime: matchedRuntime != null ? runtimeRequirementFor(matchedRuntime) : undefined
    });
    writeLiveServerFile(this.#root, exportData);
    const id = assignGitId(this.#idIndex, 'liveServerIds', 'nextLiveServerId', uuid);
    const now = Date.now();
    this.#liveServerTimestamps.set(uuid, { createdAt: now, updatedAt: now });
    this.#liveServers.set(id, exportData);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.exportToLiveServer(id, exportData);
  }

  /**
   * @inheritdoc
   */
  async updateLiveServer(input: UpdateLiveServerInput): Promise<LiveServer> {
    const existing = this.#liveServers.get(input.id);
    if (!existing) throw new Error(`Live server not found: ${input.id}`);
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const payload = parseLiveServerPayload(serializeLiveServerPayload(input));
    const { runtimeId, ...exportFields } = payload;
    const matchedRuntime =
      runtimeId !== '' ? listRuntimes().find((runtime) => runtime.id === runtimeId) : undefined;
    const updated = buildLiveServerExport({
      uuid: existing.uuid,
      name,
      ...exportFields,
      runtime: matchedRuntime != null ? runtimeRequirementFor(matchedRuntime) : undefined
    });
    writeLiveServerFile(this.#root, updated);
    this.#liveServers.set(input.id, updated);
    const timestamps = this.#liveServerTimestamps.get(existing.uuid);
    this.#liveServerTimestamps.set(existing.uuid, {
      createdAt: timestamps?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    });
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.exportToLiveServer(input.id, updated);
  }

  /**
   * @inheritdoc
   */
  async deleteLiveServer(id: number): Promise<void> {
    const existing = this.#liveServers.get(id);
    if (!existing) throw new Error(`Live server not found: ${id}`);
    const uuid = resolveImportUuid(existing.uuid);
    deleteLiveServerFile(this.#root, uuid);
    delete this.#idIndex.liveServerIds[uuid];
    this.#liveServers.delete(id);
    this.#liveServerTimestamps.delete(uuid);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
  }

  /**
   * @inheritdoc
   */
  async listLivePages(): Promise<Website[]> {
    return [...this.#livePages.entries()]
      .map(([id, page]) => this.exportToLivePage(id, page))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * @inheritdoc
   */
  async createLivePage(input: CreateWebsiteInput): Promise<Website> {
    const uuid = input.uuid?.trim() || generateDocumentUuid();
    const payload = parseLivePagePayload(serializeLivePagePayload(input));
    const exportData = buildWebsiteExport({
      uuid,
      name: trimRequiredName(input.name, 'Live page name'),
      ...payload
    });
    writeLivePageFile(this.#root, exportData);
    const id = assignGitId(this.#idIndex, 'livePageIds', 'nextLivePageId', uuid);
    const now = Date.now();
    this.#livePageTimestamps.set(uuid, { createdAt: now, updatedAt: now });
    this.#livePages.set(id, exportData);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.exportToLivePage(id, exportData);
  }

  /**
   * @inheritdoc
   */
  async updateLivePage(input: UpdateWebsiteInput): Promise<Website> {
    const existing = this.#livePages.get(input.id);
    if (!existing) throw new Error(`Live page not found: ${input.id}`);
    const payload = parseLivePagePayload(serializeLivePagePayload(input));
    const updated = buildWebsiteExport({
      uuid: existing.uuid,
      name: trimRequiredName(input.name, 'Live page name'),
      ...payload
    });
    writeLivePageFile(this.#root, updated);
    this.#livePages.set(input.id, updated);
    const timestamps = this.#livePageTimestamps.get(existing.uuid);
    this.#livePageTimestamps.set(existing.uuid, {
      createdAt: timestamps?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    });
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.exportToLivePage(input.id, updated);
  }

  /**
   * @inheritdoc
   */
  async deleteLivePage(id: number): Promise<void> {
    const existing = this.#livePages.get(id);
    if (!existing) throw new Error(`Live page not found: ${id}`);
    const uuid = resolveImportUuid(existing.uuid);
    deleteLivePageFile(this.#root, uuid);
    delete this.#idIndex.livePageIds[uuid];
    this.#livePages.delete(id);
    this.#livePageTimestamps.delete(uuid);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
  }

  /**
   * Git-backed storage does not persist run result snapshots.
   */
  async listRunResults(): Promise<ProviderRunResultSummary[]> {
    return [];
  }

  /**
   * Git-backed storage does not persist run result snapshots.
   */
  async saveRunResult(input: SaveRunResultInput): Promise<ProviderRunResult> {
    void input;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * Git-backed storage does not persist run result snapshots.
   */
  async getRunResult(id: number): Promise<ProviderRunResult | null> {
    void id;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * Git-backed storage does not persist run result snapshots.
   */
  async deleteRunResult(id: number): Promise<void> {
    void id;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * @inheritdoc
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const loaded = this.#collections.get(collectionId);
    if (!loaded) {
      return [];
    }
    const folderMaps = buildFolderImportMaps(this.buildFolders(collectionId, loaded));
    return loaded.requests
      .map((request) => this.exportedRequestToSaved(collectionId, request, folderMaps))
      .sort((a, b) => {
        const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
      });
  }

  /**
   * @inheritdoc
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const trimmedName = trimRequiredName(input.name, 'Request name');
    const loaded = this.requireCollection(input.collection_id);
    const folderMaps = buildFolderImportMaps(this.buildFolders(input.collection_id, loaded));
    const folderNameById = new Map(
      this.buildFolders(input.collection_id, loaded).map((folder) => [folder.id, folder.name])
    );

    let requestUuid = input.uuid?.trim();
    let requestId = input.id;
    if (requestId != null) {
      const existing = loaded.requests.find(
        (row) =>
          this.#idIndex.requestIds[resolveImportUuid(row.uuid)] === requestId ||
          resolveImportUuid(row.uuid) === requestUuid
      );
      if (existing) {
        requestUuid = resolveImportUuid(existing.uuid);
      }
    }
    if (!requestUuid) {
      requestUuid = generateDocumentUuid();
    }
    requestId = requestId ?? assignGitId(this.#idIndex, 'requestIds', 'nextRequestId', requestUuid);

    if (input.folder_id != null && !folderMaps.folderUuidById.has(input.folder_id)) {
      throw new Error('Folder not found');
    }

    const folderName =
      input.folder_id != null ? (folderNameById.get(input.folder_id) ?? null) : null;
    const folderUuid =
      input.folder_id != null
        ? (loaded.manifest.folders.find(
            (row) => this.#idIndex.folderIds[row.uuid] === input.folder_id
          )?.uuid ?? null)
        : null;

    const existingRequest = loaded.requests.find(
      (row) => resolveImportUuid(row.uuid) === requestUuid
    );

    const exported: ExportedRequest = {
      uuid: requestUuid,
      name: trimmedName,
      method: input.method,
      url: input.url,
      headers: input.headers,
      userAgent: typeof input.userAgent === 'string' ? input.userAgent : '',
      params: input.params,
      auth: input.auth,
      body: input.body,
      body_type: input.body_type,
      body_raw: input.body_raw ?? null,
      body_raw_open: input.body_raw_open === true,
      pre_request_script: input.pre_request_script ?? '',
      post_request_script: input.post_request_script ?? '',
      pre_request_scripts: input.pre_request_scripts ?? [],
      post_request_scripts: input.post_request_scripts ?? [],
      comment: input.comment,
      tags: input.tags ?? '',
      sort_order:
        existingRequest?.sort_order ??
        loaded.requests.filter((row) => (row.folder_name ?? null) === (folderName ?? null)).length,
      folder_name: folderName,
      folder_uuid: folderUuid,
      marker:
        input.marker !== undefined
          ? serializeSidebarMarker(input.marker)
          : (existingRequest?.marker ?? null)
    };

    const index = loaded.requests.findIndex((row) => resolveImportUuid(row.uuid) === requestUuid);
    const isNewRequest = index < 0;
    if (index >= 0) {
      loaded.requests[index] = exported;
      // Collapse any legacy duplicate rows that share this UUID (from orphan
      // slug files) so the saved request is represented by exactly one row.
      loaded.requests = loaded.requests.filter(
        (row, rowIndex) => rowIndex === index || resolveImportUuid(row.uuid) !== requestUuid
      );
    } else {
      loaded.requests.push(exported);
    }

    this.persistCollection(input.collection_id);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);

    if (isNewRequest) {
      await this.autoTrackNewItem(input.collection_id, requestUuid);
    }

    const now = new Date().toISOString();
    const previousTimestamps = this.#requestTimestamps.get(requestUuid);
    this.#requestTimestamps.set(requestUuid, {
      created_at: previousTimestamps?.created_at ?? now,
      updated_at: now
    });

    return this.exportedRequestToSaved(input.collection_id, exported, folderMaps);
  }

  /**
   * @inheritdoc
   */
  async setRequestMarker(id: number, marker: string | null): Promise<SavedRequest> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const request = loaded.requests.find(
        (row) => this.#idIndex.requestIds[resolveImportUuid(row.uuid)] === id
      );
      if (!request) {
        continue;
      }

      request.marker = serializeSidebarMarker(marker);
      this.persistCollection(collectionId);
      const folderMaps = buildFolderImportMaps(this.buildFolders(collectionId, loaded));
      return this.exportedRequestToSaved(collectionId, request, folderMaps);
    }
    throw new Error('Request not found');
  }

  /**
   * @inheritdoc
   */
  async deleteRequest(id: number): Promise<void> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const index = loaded.requests.findIndex(
        (row) => this.#idIndex.requestIds[resolveImportUuid(row.uuid)] === id
      );
      if (index >= 0) {
        const uuid = resolveImportUuid(loaded.requests[index].uuid);
        loaded.requests.splice(index, 1);
        delete this.#idIndex.requestIds[uuid];
        this.#requestTimestamps.delete(uuid);
        this.persistCollection(collectionId);
        saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
        return;
      }
    }
    throw new Error('Request not found');
  }

  /**
   * @inheritdoc
   */
  async listFolders(collectionId: number): Promise<Folder[]> {
    const loaded = this.requireCollection(collectionId);
    return this.buildFolders(collectionId, loaded);
  }

  /**
   * @inheritdoc
   */
  async createFolder(
    collectionId: number,
    name: string,
    parentFolderId?: number | null
  ): Promise<Folder> {
    const loaded = this.requireCollection(collectionId);
    const trimmedName = trimRequiredName(name, 'Folder name');
    const parentId = parentFolderId ?? null;
    const existingFolders = this.buildFolders(collectionId, loaded);
    assertValidFolderParent(existingFolders, collectionId, parentId);
    const parentUuid =
      parentId != null
        ? (loaded.manifest.folders.find((row) => this.#idIndex.folderIds[row.uuid] === parentId)
            ?.uuid ?? null)
        : null;
    if (parentId != null && parentUuid == null) {
      throw new Error('Folder not found');
    }
    const sort_order = maxSiblingFolderSortOrder(existingFolders, parentId) + 1;
    const folder = createStoredFolder(trimmedName, sort_order, parentUuid);
    loaded.manifest.folders.push(folder);
    const folderId = assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', folder.uuid);
    this.persistCollection(collectionId);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.storedFolderToFolder(collectionId, folder, folderId);
  }

  /**
   * Moves a folder to a new parent and optional sibling index.
   *
   * @param folderId - Folder to move.
   * @param parentFolderId - New parent folder id, or null for collection root.
   * @param sortOrder - Optional zero-based index among new siblings.
   * @returns The updated folder.
   */
  async moveFolder(
    folderId: number,
    parentFolderId: number | null,
    sortOrder?: number
  ): Promise<Folder> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const folder = loaded.manifest.folders.find(
        (row) => this.#idIndex.folderIds[row.uuid] === folderId
      );
      if (!folder) {
        continue;
      }

      const folders = this.buildFolders(collectionId, loaded);
      assertValidFolderParent(folders, collectionId, parentFolderId);
      if (wouldCreateFolderCycle(folderId, parentFolderId, folders)) {
        throw new Error('Cannot move a folder under itself or a descendant');
      }

      const parentUuid =
        parentFolderId != null
          ? (loaded.manifest.folders.find(
              (row) => this.#idIndex.folderIds[row.uuid] === parentFolderId
            )?.uuid ?? null)
          : null;
      if (parentFolderId != null && parentUuid == null) {
        throw new Error('Folder not found');
      }

      const destSiblings = folders
        .filter(
          (candidate) =>
            candidate.id !== folderId && (candidate.parent_folder_id ?? null) === parentFolderId
        )
        .sort(
          (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
        );
      const targetIndex =
        sortOrder != null
          ? Math.max(0, Math.min(sortOrder, destSiblings.length))
          : destSiblings.length;
      const orderedIds = [
        ...destSiblings.slice(0, targetIndex).map((candidate) => candidate.id),
        folderId,
        ...destSiblings.slice(targetIndex).map((candidate) => candidate.id)
      ];

      folder.parent_uuid = parentUuid;
      await this.reorderFolders(collectionId, parentFolderId, orderedIds);
      this.persistCollection(collectionId);
      return this.storedFolderToFolder(collectionId, folder, folderId);
    }
    throw new Error('Folder not found');
  }

  /**
   * @inheritdoc
   */
  async renameFolder(id: number, name: string): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const folder = loaded.manifest.folders.find(
        (row) => this.#idIndex.folderIds[row.uuid] === id
      );
      if (folder) {
        const oldName = folder.name;
        folder.name = trimmedName;
        for (const request of loaded.requests) {
          if (request.folder_name === oldName) {
            request.folder_name = trimmedName;
          }
        }
        for (const document of loaded.documents) {
          if (document.folder_name === oldName) {
            document.folder_name = trimmedName;
          }
        }
        this.persistCollection(collectionId);
        return this.storedFolderToFolder(collectionId, folder, id);
      }
    }
    throw new Error('Folder not found');
  }

  /**
   * @inheritdoc
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
    const trimmedName = trimRequiredName(name, 'Folder name');
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const folder = loaded.manifest.folders.find(
        (row) => this.#idIndex.folderIds[row.uuid] === id
      );
      if (folder) {
        const oldName = folder.name;
        folder.name = trimmedName;
        folder.variables = variables;
        folder.headers = headers;
        folder.userAgent = userAgent;
        folder.auth = auth;
        folder.pre_request_script = preRequestScript;
        folder.post_request_script = postRequestScript;
        folder.pre_request_scripts = preRequestScripts;
        folder.post_request_scripts = postRequestScripts;
        if (oldName !== trimmedName) {
          for (const request of loaded.requests) {
            if (request.folder_name === oldName) {
              request.folder_name = trimmedName;
            }
          }
          for (const document of loaded.documents) {
            if (document.folder_name === oldName) {
              document.folder_name = trimmedName;
            }
          }
        }
        this.persistCollection(collectionId);
        return this.storedFolderToFolder(collectionId, folder, id);
      }
    }
    throw new Error('Folder not found');
  }

  /**
   * @inheritdoc
   */
  async setFolderMarker(id: number, marker: string | null): Promise<Folder> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const folder = loaded.manifest.folders.find(
        (row) => this.#idIndex.folderIds[row.uuid] === id
      );
      if (!folder) {
        continue;
      }

      folder.marker = serializeSidebarMarker(marker);
      this.persistCollection(collectionId);
      return this.storedFolderToFolder(collectionId, folder, id);
    }
    throw new Error('Folder not found');
  }

  /**
   * @inheritdoc
   */
  async deleteFolder(id: number): Promise<void> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const folder = loaded.manifest.folders.find(
        (row) => this.#idIndex.folderIds[row.uuid] === id
      );
      if (!folder) {
        continue;
      }

      const folders = this.buildFolders(collectionId, loaded);
      const subtreeIds = new Set(folderSubtreeIdsForDeletion(id, folders));
      const subtreeUuids = new Set(
        loaded.manifest.folders
          .filter((row) => subtreeIds.has(this.#idIndex.folderIds[row.uuid] ?? -1))
          .map((row) => row.uuid)
      );
      const subtreeNames = new Set(
        loaded.manifest.folders.filter((row) => subtreeUuids.has(row.uuid)).map((row) => row.name)
      );

      loaded.manifest.folders = loaded.manifest.folders.filter(
        (row) => !subtreeUuids.has(row.uuid)
      );
      for (const folderUuid of subtreeUuids) {
        delete this.#idIndex.folderIds[folderUuid];
      }

      loaded.requests = loaded.requests.filter(
        (request) =>
          (request.folder_uuid == null || !subtreeUuids.has(request.folder_uuid)) &&
          (request.folder_name == null || !subtreeNames.has(request.folder_name))
      );
      for (const document of loaded.documents) {
        if (
          (document.folder_uuid != null && subtreeUuids.has(document.folder_uuid)) ||
          ((document.folder_name ?? null) != null && subtreeNames.has(document.folder_name!))
        ) {
          const documentUuid = resolveImportUuid(document.uuid);
          delete this.#idIndex.documentIds[documentUuid];
          this.#documentTimestamps.delete(documentUuid);
        }
      }
      loaded.documents = loaded.documents.filter(
        (document) =>
          (document.folder_uuid == null || !subtreeUuids.has(document.folder_uuid)) &&
          (document.folder_name == null || !subtreeNames.has(document.folder_name!))
      );
      this.persistCollection(collectionId);
      saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
      return;
    }
    throw new Error('Folder not found');
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
    const loaded = this.requireCollection(collectionId);
    const folders = this.buildFolders(collectionId, loaded);
    assertFolderSiblingReorder(folders, collectionId, parentFolderId, orderedFolderIds);

    const idToFolder = new Map(
      loaded.manifest.folders.map((row) => [this.#idIndex.folderIds[row.uuid], row])
    );
    for (let index = 0; index < orderedFolderIds.length; index++) {
      const folder = idToFolder.get(orderedFolderIds[index]);
      if (folder) {
        folder.sort_order = index;
      }
    }
    this.persistCollection(collectionId);
  }

  /**
   * @inheritdoc
   */
  async reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void> {
    const loaded = this.requireCollection(collectionId);
    const folderName =
      folderId != null
        ? (loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)
            ?.name ?? null)
        : null;

    const inContainer = loaded.requests.filter((request) => {
      const name = request.folder_name ?? null;
      return folderId == null ? name == null || name === '' : name === folderName;
    });

    const idToRequest = new Map(
      inContainer.map((request) => [
        this.#idIndex.requestIds[resolveImportUuid(request.uuid)],
        request
      ])
    );

    let order = 0;
    for (const requestId of orderedRequestIds) {
      const request = idToRequest.get(requestId);
      if (request) {
        request.sort_order = order++;
      }
    }
    this.persistCollection(collectionId);
  }

  /**
   * @inheritdoc
   */
  async reorderContainerItems(
    collectionId: number,
    folderId: number | null,
    items: ContainerItemRef[]
  ): Promise<void> {
    const loaded = this.requireCollection(collectionId);
    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    assertContainerItemOrder(collectionId, folderId, items, requests, documents);

    const targetFolder =
      folderId != null
        ? loaded.manifest.folders.find(
            (folder) => this.#idIndex.folderIds[folder.uuid] === folderId
          )
        : undefined;
    if (folderId != null && !targetFolder) {
      throw new Error('Folder not found');
    }

    const folderName = targetFolder?.name ?? null;
    const folderUuid = targetFolder?.uuid ?? null;
    const requestById = new Map(
      loaded.requests.map((request) => [
        this.#idIndex.requestIds[resolveImportUuid(request.uuid)],
        request
      ])
    );
    const documentById = new Map(
      loaded.documents.map((document) => [
        this.#idIndex.documentIds[resolveImportUuid(document.uuid)],
        document
      ])
    );

    items.forEach((item, unifiedIndex) => {
      if (item.kind === 'request') {
        const request = requestById.get(item.id);
        if (request) {
          request.sort_order = unifiedIndex;
          request.folder_name = folderName;
          request.folder_uuid = folderUuid;
        }
        return;
      }

      const document = documentById.get(item.id);
      if (document) {
        document.sort_order = unifiedIndex;
        document.folder_name = folderName;
        document.folder_uuid = folderUuid;
      }
    });

    this.persistCollection(collectionId);
  }

  /**
   * @inheritdoc
   */
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const request = loaded.requests.find(
        (row) => this.#idIndex.requestIds[resolveImportUuid(row.uuid)] === requestId
      );
      if (!request) {
        continue;
      }

      if (folderId != null) {
        const targetFolder = loaded.manifest.folders.find(
          (folder) => this.#idIndex.folderIds[folder.uuid] === folderId
        );
        if (!targetFolder) {
          throw new Error('Folder not found');
        }
      }

      const requests = await this.listRequests(collectionId);
      const documents = await this.listDocuments(collectionId);
      const savedRequest = requests.find((row) => row.id === requestId);
      if (!savedRequest) {
        throw new Error('Request not found');
      }
      const sourceFolderId = savedRequest.folder_id ?? null;
      const plan = planContainerItemMove(
        requests,
        documents,
        { kind: 'request', id: requestId },
        sourceFolderId,
        folderId,
        index
      );

      if (plan.sourceOrder) {
        await this.reorderContainerItems(collectionId, sourceFolderId, plan.sourceOrder);
      }
      await this.reorderContainerItems(collectionId, folderId, plan.destinationOrder);
      return;
    }
    throw new Error('Request not found');
  }

  /**
   * @inheritdoc
   */
  async listDocuments(collectionId: number): Promise<CollectionDocument[]> {
    const loaded = this.#collections.get(collectionId);
    if (!loaded) {
      return [];
    }
    const folderMaps = buildFolderImportMaps(this.buildFolders(collectionId, loaded));
    return loaded.documents
      .map((document) => this.exportedDocumentToSaved(collectionId, document, folderMaps))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  /**
   * @inheritdoc
   */
  async saveDocument(input: SaveDocumentInput): Promise<CollectionDocument> {
    const trimmedName = trimRequiredName(input.name, 'Document name');
    const loaded = this.requireCollection(input.collection_id);
    const folderMaps = buildFolderImportMaps(this.buildFolders(input.collection_id, loaded));
    const folderNameById = new Map(
      this.buildFolders(input.collection_id, loaded).map((folder) => [folder.id, folder.name])
    );

    let documentUuid = input.uuid?.trim();
    let documentId = input.id;
    if (documentId != null) {
      const existing = loaded.documents.find(
        (row) =>
          this.#idIndex.documentIds[resolveImportUuid(row.uuid)] === documentId ||
          resolveImportUuid(row.uuid) === documentUuid
      );
      if (existing) {
        documentUuid = resolveImportUuid(existing.uuid);
      }
    }
    if (!documentUuid) {
      documentUuid = generateDocumentUuid();
    }
    documentId =
      documentId ?? assignGitId(this.#idIndex, 'documentIds', 'nextDocumentId', documentUuid);

    if (input.folder_id != null && !folderMaps.folderUuidById.has(input.folder_id)) {
      throw new Error('Folder not found');
    }

    const folderName =
      input.folder_id != null ? (folderNameById.get(input.folder_id) ?? null) : null;
    const folderUuid =
      input.folder_id != null
        ? (loaded.manifest.folders.find(
            (row) => this.#idIndex.folderIds[row.uuid] === input.folder_id
          )?.uuid ?? null)
        : null;

    const existingDocument = loaded.documents.find(
      (row) => resolveImportUuid(row.uuid) === documentUuid
    );

    assertDocumentFilenameAvailable(loaded.dirPath, trimmedName, documentUuid);

    const exported: ExportedDocument = {
      uuid: documentUuid,
      name: trimmedName,
      content: input.content ?? '',
      sort_order:
        existingDocument?.sort_order ??
        loaded.documents.filter(
          (row) =>
            (row.folder_uuid ?? null) === (folderUuid ?? null) &&
            (row.folder_name ?? null) === (folderName ?? null)
        ).length,
      folder_name: folderName,
      folder_uuid: folderUuid,
      marker:
        input.marker !== undefined
          ? serializeSidebarMarker(input.marker)
          : (existingDocument?.marker ?? null)
    };

    const index = loaded.documents.findIndex((row) => resolveImportUuid(row.uuid) === documentUuid);
    const isNewDocument = index < 0;
    if (index >= 0) {
      loaded.documents[index] = exported;
    } else {
      loaded.documents.push(exported);
    }

    this.persistCollection(input.collection_id);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);

    if (isNewDocument) {
      await this.autoTrackNewItem(input.collection_id, documentUuid);
    }

    const now = new Date().toISOString();
    const previousTimestamps = this.#documentTimestamps.get(documentUuid);
    this.#documentTimestamps.set(documentUuid, {
      created_at: previousTimestamps?.created_at ?? now,
      updated_at: now
    });

    return this.exportedDocumentToSaved(input.collection_id, exported, folderMaps);
  }

  /**
   * @inheritdoc
   */
  async setDocumentMarker(id: number, marker: string | null): Promise<CollectionDocument> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const document = loaded.documents.find(
        (row) => this.#idIndex.documentIds[resolveImportUuid(row.uuid)] === id
      );
      if (!document) {
        continue;
      }

      document.marker = serializeSidebarMarker(marker);
      this.persistCollection(collectionId);
      const folderMaps = buildFolderImportMaps(this.buildFolders(collectionId, loaded));
      return this.exportedDocumentToSaved(collectionId, document, folderMaps);
    }
    throw new Error('Document not found');
  }

  /**
   * @inheritdoc
   */
  async deleteDocument(id: number): Promise<void> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const index = loaded.documents.findIndex(
        (row) => this.#idIndex.documentIds[resolveImportUuid(row.uuid)] === id
      );
      if (index >= 0) {
        const uuid = resolveImportUuid(loaded.documents[index].uuid);
        loaded.documents.splice(index, 1);
        delete this.#idIndex.documentIds[uuid];
        this.#documentTimestamps.delete(uuid);
        this.persistCollection(collectionId);
        saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
        return;
      }
    }
    throw new Error('Document not found');
  }

  /**
   * @inheritdoc
   */
  async reorderDocuments(
    collectionId: number,
    folderId: number | null,
    orderedDocumentIds: number[]
  ): Promise<void> {
    const loaded = this.requireCollection(collectionId);
    const folderName =
      folderId != null
        ? (loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)
            ?.name ?? null)
        : null;
    const folderUuid =
      folderId != null
        ? (loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)
            ?.uuid ?? null)
        : null;

    const inContainer = loaded.documents.filter((document) => {
      if (folderId == null) {
        return (document.folder_name ?? null) == null && (document.folder_uuid ?? null) == null;
      }
      return document.folder_uuid === folderUuid || document.folder_name === folderName;
    });

    const idToDocument = new Map(
      inContainer.map((document) => [
        this.#idIndex.documentIds[resolveImportUuid(document.uuid)],
        document
      ])
    );

    let order = 0;
    for (const documentId of orderedDocumentIds) {
      const document = idToDocument.get(documentId);
      if (document) {
        document.sort_order = order++;
        document.folder_name = folderName;
        document.folder_uuid = folderUuid;
      }
    }
    this.persistCollection(collectionId);
  }

  /**
   * @inheritdoc
   */
  async moveDocument(documentId: number, folderId: number | null, index: number): Promise<void> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const document = loaded.documents.find(
        (row) => this.#idIndex.documentIds[resolveImportUuid(row.uuid)] === documentId
      );
      if (!document) {
        continue;
      }

      if (folderId != null) {
        const targetFolder = loaded.manifest.folders.find(
          (folder) => this.#idIndex.folderIds[folder.uuid] === folderId
        );
        if (!targetFolder) {
          throw new Error('Folder not found');
        }
      }

      const requests = await this.listRequests(collectionId);
      const documents = await this.listDocuments(collectionId);
      const savedDocument = documents.find((row) => row.id === documentId);
      if (!savedDocument) {
        throw new Error('Document not found');
      }
      const sourceFolderId = savedDocument.folder_id ?? null;
      const plan = planContainerItemMove(
        requests,
        documents,
        { kind: 'document', id: documentId },
        sourceFolderId,
        folderId,
        index
      );

      if (plan.sourceOrder) {
        await this.reorderContainerItems(collectionId, sourceFolderId, plan.sourceOrder);
      }
      await this.reorderContainerItems(collectionId, folderId, plan.destinationOrder);
      return;
    }
    throw new Error('Document not found');
  }

  /**
   * @inheritdoc
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const loaded = this.requireCollection(id);
    return buildCollectionExportFromLoaded({
      ...loaded,
      manifest: {
        ...loaded.manifest,
        variables: maskVariablesForExport(loaded.manifest.variables)
      }
    });
  }

  /**
   * @inheritdoc
   */
  async importCollectionData(data: unknown): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const uuid = resolveImportUuid(exportData.uuid);
    const existingId = this.#idIndex.collectionIds[uuid];
    if (existingId != null) {
      return this.updateCollectionFromImport(existingId, exportData);
    }

    const collectionScripts = serializeImportedCollectionScriptFields(exportData);
    const manifest: GitStoredManifest = {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid,
      name: exportData.name,
      marker: serializeSidebarMarker(exportData.marker),
      variables: exportData.variables,
      headers: exportData.headers,
      userAgent: typeof exportData.userAgent === 'string' ? exportData.userAgent : '',
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: exportData.pre_request_scripts ?? [],
      post_request_scripts: exportData.post_request_scripts ?? [],
      folders: (exportData.folders ?? []).map((folder, index) => ({
        ...importedFolderToStoredRow(folder, index),
        parent_uuid:
          folder.parent_folder_uuid == null || folder.parent_folder_uuid === ''
            ? null
            : resolveImportUuid(folder.parent_folder_uuid)
      })),
      created_at: new Date().toISOString()
    };
    const requests = exportData.requests;
    const documents = exportData.documents ?? [];
    const dirPath = writeCollectionToFolder(
      this.#root,
      buildCollectionExportFromLoaded({
        dirPath: collectionDirPath(this.#root, manifest.name),
        manifest,
        requests,
        documents
      })
    );
    const id = assignGitId(this.#idIndex, 'collectionIds', 'nextCollectionId', uuid);
    this.#collections.set(id, {
      dirPath,
      manifest,
      requests,
      documents
    });
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.manifestToCollection(id, manifest);
  }

  /**
   * @inheritdoc
   */
  async findCollectionByUuid(uuid: string): Promise<Collection | null> {
    const id = this.#idIndex.collectionIds[uuid];
    if (id == null) {
      return null;
    }
    const loaded = this.#collections.get(id);
    return loaded ? this.manifestToCollection(id, loaded.manifest) : null;
  }

  /**
   * @inheritdoc
   */
  async findRequestByUuid(collectionId: number, uuid: string): Promise<SavedRequest | null> {
    const loaded = this.requireCollection(collectionId);
    const request = loaded.requests.find((row) => resolveImportUuid(row.uuid) === uuid);
    if (!request) {
      return null;
    }
    const folderMaps = buildFolderImportMaps(this.buildFolders(collectionId, loaded));
    return this.exportedRequestToSaved(collectionId, request, folderMaps);
  }

  /**
   * @inheritdoc
   */
  async updateCollectionFromImport(id: number, data: CollectionExport): Promise<Collection> {
    const loaded = this.requireCollection(id);
    const exportData = validateCollectionExport(data);
    // Snapshot so a failed persist (e.g. duplicate sibling folder names) does not
    // leave the in-memory collection in a half-merged state that breaks retries.
    const snapshot = {
      manifest: structuredClone(loaded.manifest),
      requests: structuredClone(loaded.requests),
      documents: structuredClone(loaded.documents)
    };

    try {
      return await this.applyCollectionImportUpdate(id, loaded, exportData);
    } catch (error) {
      loaded.manifest = snapshot.manifest;
      loaded.requests = snapshot.requests;
      loaded.documents = snapshot.documents;
      throw error;
    }
  }

  /**
   * Applies an additive collection import merge and persists the result.
   *
   * @param id - Provider-local collection id.
   * @param loaded - In-memory collection state to mutate.
   * @param exportData - Validated portable collection export from the import source.
   * @returns Updated collection entity after persist.
   */
  private async applyCollectionImportUpdate(
    id: number,
    loaded: LoadedCollection,
    exportData: CollectionExport
  ): Promise<Collection> {
    const folderMaps = buildFolderImportMaps(this.buildFolders(id, loaded));

    const collectionScripts = serializeImportedCollectionScriptFields(exportData);
    loaded.manifest = {
      ...loaded.manifest,
      name: exportData.name,
      marker: serializeSidebarMarker(exportData.marker),
      variables: exportData.variables,
      headers: exportData.headers,
      userAgent: typeof exportData.userAgent === 'string' ? exportData.userAgent : '',
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: exportData.pre_request_scripts ?? [],
      post_request_scripts: exportData.post_request_scripts ?? []
    };

    for (const folder of sortExportedFoldersParentFirst(exportData.folders ?? [])) {
      const parentFolderId = resolveImportedFolderParentId(folder, folderMaps.folderIdByUuid);
      let plan = planImportedFolderUpsert(folder, folderMaps, parentFolderId);
      const parentUuid =
        parentFolderId != null ? (folderMaps.folderUuidById.get(parentFolderId) ?? null) : null;

      // Safety net: never insert a sibling that would duplicate an existing name
      // under the same parent (Postman/OpenCollection refresh regenerates uuids).
      if (plan.action === 'insert') {
        const existingSibling = loaded.manifest.folders.find(
          (row) => row.name === plan.name && (row.parent_uuid ?? null) === parentUuid
        );
        if (existingSibling) {
          const existingId = this.#idIndex.folderIds[existingSibling.uuid];
          if (existingId != null) {
            plan = {
              action: 'update',
              existingId,
              name: plan.name,
              sort_order: plan.sort_order,
              uuid: plan.uuid,
              marker: plan.marker
            };
          }
        }
      }

      if (plan.action === 'update') {
        const existing = loaded.manifest.folders.find(
          (row) => this.#idIndex.folderIds[row.uuid] === plan.existingId
        );
        if (!existing) {
          throw new Error('Folder not found');
        }
        // Keep the local uuid stable across Postman/OpenCollection refreshes that
        // regenerate folder uuids; register the import uuid for child/request links.
        const localUuid = existing.uuid;
        Object.assign(
          existing,
          importedFolderToStoredRow({ ...folder, uuid: localUuid }, plan.sort_order),
          {
            parent_uuid: parentUuid
          }
        );
        existing.uuid = localUuid;
        registerImportedFolderInMaps(
          folderMaps,
          plan.existingId,
          plan.name,
          plan.uuid,
          parentFolderId
        );
        folderMaps.folderIdByUuid.set(localUuid, plan.existingId);
        folderMaps.folderUuidById.set(plan.existingId, localUuid);
        continue;
      }

      const stored = {
        ...importedFolderToStoredRow({ ...folder, uuid: plan.uuid }, plan.sort_order),
        parent_uuid: parentUuid
      };
      loaded.manifest.folders.push(stored);
      const folderId = assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', stored.uuid);
      registerImportedFolderInMaps(folderMaps, folderId, plan.name, plan.uuid, parentFolderId);
    }

    const existingSavedRequests = await this.listRequests(id);
    const requestUuidIndex = buildRequestUuidIndex(existingSavedRequests);
    const requestFingerprints = buildRequestFingerprintIndexes(existingSavedRequests);
    const documentUuidIndex = buildDocumentUuidIndex(await this.listDocuments(id));

    for (const request of exportData.requests) {
      const fields = serializeImportedRequestFields(request);
      const importedFolderId = resolveImportFolderId(
        request.folder_uuid,
        request.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const existingRequestId = resolveImportRequestId(
        fields.uuid,
        importedFolderId,
        fields.method,
        fields.name,
        fields.url,
        requestUuidIndex,
        requestFingerprints
      );
      const folderId = resolveUpsertRequestFolderId(
        importedFolderId,
        existingRequestId != null
          ? requestFingerprints.folderIdByRequestId.get(existingRequestId)
          : undefined
      );
      const matchedFolder =
        folderId != null
          ? loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)
          : undefined;
      const folderName = matchedFolder?.name ?? (folderId == null ? request.folder_name : null);
      const folderUuid = matchedFolder?.uuid ?? (folderId == null ? null : request.folder_uuid);

      const existingByUuidIndex = loaded.requests.findIndex(
        (row) => resolveImportUuid(row.uuid) === fields.uuid
      );
      const existingByIdIndex =
        existingRequestId != null
          ? loaded.requests.findIndex((row) => {
              const rowUuid = resolveImportUuid(row.uuid);
              return this.#idIndex.requestIds[rowUuid] === existingRequestId;
            })
          : -1;
      const existingIndex = existingByUuidIndex >= 0 ? existingByUuidIndex : existingByIdIndex;
      const existingRow = existingIndex >= 0 ? loaded.requests[existingIndex] : undefined;
      // Keep the local uuid when fingerprint-matching a Postman refresh so we do not churn ids.
      const persistedUuid = existingRow != null ? resolveImportUuid(existingRow.uuid) : fields.uuid;

      const exported: ExportedRequest = {
        ...request,
        uuid: persistedUuid,
        name: fields.name,
        method: fields.method,
        url: fields.url,
        headers: JSON.parse(fields.headersJson),
        userAgent: fields.userAgent,
        params: JSON.parse(fields.paramsJson),
        auth: JSON.parse(fields.authJson),
        body: fields.body,
        body_type: fields.body_type,
        body_raw: fields.body_raw,
        body_raw_open: fields.body_raw_open,
        pre_request_script: fields.pre_request_script,
        post_request_script: fields.post_request_script,
        pre_request_scripts: request.pre_request_scripts ?? [],
        post_request_scripts: request.post_request_scripts ?? [],
        comment: fields.comment,
        tags: fields.tags,
        sort_order: fields.sort_order,
        folder_name: folderName ?? request.folder_name ?? null,
        folder_uuid: folderUuid ?? null,
        marker: fields.marker
      };

      if (existingIndex >= 0) {
        loaded.requests[existingIndex] = exported;
      } else {
        loaded.requests.push(exported);
      }
      assignGitId(this.#idIndex, 'requestIds', 'nextRequestId', persistedUuid);
    }

    for (const document of exportData.documents ?? []) {
      const fields = serializeImportedDocumentFields(document);
      const folderId = resolveImportFolderId(
        document.folder_uuid,
        document.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const folderName =
        folderId != null
          ? loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)?.name
          : document.folder_name;
      const folderUuid =
        folderId != null
          ? loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)?.uuid
          : document.folder_uuid;

      const exported: ExportedDocument = {
        uuid: fields.uuid,
        name: fields.name,
        content: fields.content,
        sort_order: fields.sort_order,
        folder_name: folderName ?? document.folder_name ?? null,
        folder_uuid: folderUuid ?? document.folder_uuid ?? null,
        marker: fields.marker
      };

      const existingIndex = loaded.documents.findIndex(
        (row) => resolveImportUuid(row.uuid) === fields.uuid
      );
      if (existingIndex >= 0) {
        loaded.documents[existingIndex] = exported;
      } else if (fields.uuid && documentUuidIndex.has(fields.uuid)) {
        loaded.documents.push(exported);
      } else {
        loaded.documents.push(exported);
      }
      assignGitId(this.#idIndex, 'documentIds', 'nextDocumentId', fields.uuid);
    }

    this.persistCollection(id);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.manifestToCollection(id, loaded.manifest);
  }

  /**
   * @inheritdoc
   */
  async getSourceControlStatus(): Promise<SourceControlStatus | null> {
    return this.#sync.getStatus();
  }

  /**
   * Returns per-request and per-document git status for one git-backed collection.
   *
   * Only items with unstaged, staged, or untracked changes are included.
   *
   * @param collectionId - Provider-local collection id.
   */
  async getItemGitStatuses(collectionId: number): Promise<Record<string, GitRequestFileStatus>> {
    const loaded = this.requireCollection(collectionId);
    const collectionPrefix = this.toRepoRelativePath(loaded.dirPath);
    const pathFlags = await this.#sync.getPathFlagsUnderPrefix(collectionPrefix);
    for (const documentPath of this.getCollectionHarborDocumentRepoPaths(collectionId)) {
      if (pathFlags[documentPath] != null) {
        continue;
      }
      Object.assign(pathFlags, await this.#sync.getPathFlagsUnderPrefix(documentPath));
    }
    const uuidToRepoPath = this.buildItemUuidToRepoPath(loaded);
    const statuses: Record<string, GitRequestFileStatus> = {};

    for (const [uuid, repoPath] of uuidToRepoPath) {
      const flags = pathFlags[repoPath] ?? null;
      const status = deriveRequestFileStatus(flags);
      if (status.canAdd || status.canRemove) {
        statuses[uuid] = status;
      }
    }

    return statuses;
  }

  /**
   * Returns the number of changed request, document, and collection-manifest
   * files in one collection, including deletions that
   * {@link getItemGitStatuses} cannot map to item uuids.
   *
   * @param collectionId - Provider-local collection id.
   */
  async getChangedItemCount(collectionId: number): Promise<number> {
    const loaded = this.requireCollection(collectionId);
    const collectionPrefix = this.toRepoRelativePath(loaded.dirPath);
    const pathFlags = await this.#sync.getPathFlagsUnderPrefix(collectionPrefix);
    let count = 0;
    const countedPaths = new Set<string>();

    for (const [repoPath, flags] of Object.entries(pathFlags)) {
      const rel = repoPath.slice(collectionPrefix.length + 1);
      if (
        (isCollectionRequestOrDocumentFile(rel) || rel === COLLECTION_MANIFEST_FILE) &&
        isCountedCollectionChange(flags)
      ) {
        countedPaths.add(repoPath);
        count += 1;
      }
    }

    for (const documentPath of this.getCollectionCommitDocumentPaths(collectionId)) {
      if (countedPaths.has(documentPath)) {
        continue;
      }
      const documentFlags = await this.#sync.getPathFlagsUnderPrefix(documentPath);
      const flags = documentFlags[documentPath];
      if (flags != null && isCountedCollectionChange(flags)) {
        countedPaths.add(documentPath);
        count += 1;
      }
    }

    return count;
  }

  /**
   * Returns the repository-relative path prefix for one collection directory.
   *
   * @param collectionId - Provider-local collection id.
   */
  getCollectionRepoRelativePath(collectionId: number): string {
    const loaded = this.requireCollection(collectionId);
    return this.toRepoRelativePath(loaded.dirPath);
  }

  /**
   * Returns the repository-relative path to a collection's `collection.json` manifest.
   *
   * @param collectionId - Provider-local collection id.
   */
  getCollectionManifestRepoPath(collectionId: number): string {
    const loaded = this.requireCollection(collectionId);
    return this.toRepoRelativePath(collectionManifestPath(loaded.dirPath));
  }

  /**
   * Returns repository-relative harbor-root markdown paths currently owned by a collection.
   *
   * @param collectionId - Provider-local collection id.
   */
  getCollectionHarborDocumentRepoPaths(collectionId: number): string[] {
    const loaded = this.requireCollection(collectionId);
    const paths: string[] = [];
    for (const document of readStoredDocumentRefs(loaded.dirPath)) {
      const fileName = document.file.trim();
      if (!fileName) {
        continue;
      }
      paths.push(this.toRepoRelativePath(join(this.#root, fileName)));
    }
    return paths;
  }

  /**
   * Returns harbor-root document paths to include when committing a collection.
   *
   * Includes current on-disk document paths plus paths removed since the last
   * commit so deletions outside the collection folder are still staged.
   *
   * @param collectionId - Provider-local collection id.
   */
  getCollectionCommitDocumentPaths(collectionId: number): string[] {
    const pending = this.#pendingHarborDocumentPaths.get(collectionId);
    const paths = new Set(this.getCollectionHarborDocumentRepoPaths(collectionId));
    if (pending != null) {
      for (const path of pending) {
        paths.add(path);
      }
    }
    return [...paths];
  }

  /**
   * Clears remembered harbor-root document deletion paths after a successful commit.
   *
   * @param collectionId - Provider-local collection id.
   */
  clearPendingHarborDocumentPaths(collectionId: number): void {
    this.#pendingHarborDocumentPaths.delete(collectionId);
  }

  /**
   * Stages one request or markdown document file for commit.
   *
   * @param collectionId - Provider-local collection id.
   * @param itemUuid - Stable request or document uuid.
   */
  async stageItem(collectionId: number, itemUuid: string): Promise<void> {
    const repoPath = this.getItemRepoPath(collectionId, itemUuid);
    await this.#sync.stageFile(repoPath);
  }

  /**
   * Stages every untracked request and markdown document in a collection.
   *
   * Only items with `isUntracked: true` are staged; tracked files with unstaged
   * modifications are left alone so "Add all" matches per-item Add.
   *
   * @param collectionId - Provider-local collection id.
   * @returns Number of items staged.
   */
  async stageAllUntrackedItems(collectionId: number): Promise<number> {
    const statuses = await this.getItemGitStatuses(collectionId);
    const untrackedUuids = Object.entries(statuses)
      .filter(([, status]) => status.isUntracked)
      .map(([uuid]) => uuid);

    for (const uuid of untrackedUuids) {
      await this.stageItem(collectionId, uuid);
    }

    return untrackedUuids.length;
  }

  /**
   * Unstages one request or markdown document file.
   *
   * @param collectionId - Provider-local collection id.
   * @param itemUuid - Stable request or document uuid.
   */
  async unstageItem(collectionId: number, itemUuid: string): Promise<void> {
    const repoPath = this.getItemRepoPath(collectionId, itemUuid);
    await this.#sync.unstageFile(repoPath);
  }

  /**
   * @inheritdoc
   */
  async getSetting(key: string): Promise<string | undefined> {
    return this.#providerSettings[key];
  }

  /**
   * @inheritdoc
   */
  async setSetting(key: string, value: string): Promise<void> {
    this.#providerSettings[key] = value;
    writeGitProviderSettings(this.#userDataPath, this.#connectionId, this.#providerSettings);
  }

  /**
   * @inheritdoc
   */
  async close(): Promise<void> {
    this.#initialized = false;
  }

  /**
   * Returns loaded collection state for a numeric id.
   *
   * @param id - Provider-local collection id.
   */
  private requireCollection(id: number): LoadedCollection {
    const loaded = this.#collections.get(id);
    if (!loaded) {
      throw new Error('Collection not found');
    }
    return loaded;
  }

  /**
   * Converts an absolute path under the repository to a repository-relative path.
   *
   * @param absolutePath - Absolute file or directory path.
   */
  private toRepoRelativePath(absolutePath: string): string {
    return relative(this.#sync.repoDir, absolutePath).replace(/\\/g, '/');
  }

  /**
   * Maps request and document uuids to repository-relative file paths.
   *
   * @param loaded - In-memory git collection state.
   */
  private buildItemUuidToRepoPath(loaded: LoadedCollection): Map<string, string> {
    const map = new Map<string, string>();

    for (const [uuid, fileName] of buildExistingRequestFileMap(loaded.dirPath)) {
      map.set(uuid, this.toRepoRelativePath(join(loaded.dirPath, fileName)));
    }

    for (const document of readStoredDocumentRefs(loaded.dirPath)) {
      const uuid = resolveImportUuid(document.uuid);
      if (!uuid || !document.file.trim()) {
        continue;
      }
      map.set(uuid, this.toRepoRelativePath(join(this.#root, document.file)));
    }

    return map;
  }

  /**
   * Resolves one item uuid to its repository-relative file path.
   *
   * @param collectionId - Provider-local collection id.
   * @param itemUuid - Stable request or document uuid.
   * @returns Repository-relative path for the item file.
   * @throws When the item is not found in the collection folder.
   */
  getItemRepoPath(collectionId: number, itemUuid: string): string {
    const normalizedUuid = resolveImportUuid(itemUuid);
    const loaded = this.requireCollection(collectionId);
    const repoPath = this.buildItemUuidToRepoPath(loaded).get(normalizedUuid);
    if (!repoPath) {
      throw new Error('Item not found in collection.');
    }
    return repoPath;
  }

  /**
   * Writes collection manifest and requests to disk.
   *
   * @param collectionId - Provider-local collection id.
   */
  private persistCollection(collectionId: number): void {
    const loaded = this.requireCollection(collectionId);
    const oldDirPath = loaded.dirPath;
    const previousDocumentPaths = new Set<string>();
    for (const refsDir of [oldDirPath]) {
      for (const document of readStoredDocumentRefs(refsDir)) {
        const fileName = document.file.trim();
        if (fileName) {
          previousDocumentPaths.add(this.toRepoRelativePath(join(this.#root, fileName)));
        }
      }
    }
    const targetDirPath = collectionDirPath(this.#root, loaded.manifest.name);
    loaded.dirPath = writeCollectionToFolder(this.#root, buildCollectionExportFromLoaded(loaded), {
      previousDirPath: oldDirPath !== targetDirPath ? oldDirPath : null
    });

    const nextDocumentPaths = new Set(this.getCollectionHarborDocumentRepoPaths(collectionId));
    let pending = this.#pendingHarborDocumentPaths.get(collectionId);
    for (const previousPath of previousDocumentPaths) {
      if (nextDocumentPaths.has(previousPath)) {
        continue;
      }
      if (pending == null) {
        pending = new Set();
        this.#pendingHarborDocumentPaths.set(collectionId, pending);
      }
      pending.add(previousPath);
    }
  }

  /**
   * Reads a collection folder into in-memory git collection state.
   *
   * @param dirPath - Absolute path to the collection folder.
   */
  private loadCollectionFromFolder(dirPath: string): {
    manifest: GitStoredManifest;
    requests: ExportedRequest[];
    documents: ExportedDocument[];
  } {
    const exportData = readCollectionFromFolder(dirPath);
    const manifest: GitStoredManifest = {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: resolveImportUuid(exportData.uuid),
      name: exportData.name,
      marker: exportData.marker ?? null,
      variables: exportData.variables,
      headers: exportData.headers,
      userAgent: typeof exportData.userAgent === 'string' ? exportData.userAgent : '',
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: exportData.pre_request_script,
      post_request_script: exportData.post_request_script,
      pre_request_scripts: exportData.pre_request_scripts ?? [],
      post_request_scripts: exportData.post_request_scripts ?? [],
      folders: (exportData.folders ?? []).map((folder, index) => ({
        uuid: resolveImportUuid(folder.uuid),
        name: folder.name,
        sort_order: folder.sort_order ?? index,
        parent_uuid:
          folder.parent_folder_uuid == null || folder.parent_folder_uuid === ''
            ? null
            : resolveImportUuid(folder.parent_folder_uuid),
        variables: folder.variables ?? [],
        headers: folder.headers ?? [],
        userAgent: typeof folder.userAgent === 'string' ? folder.userAgent : '',
        auth: folder.auth ?? defaultAuth(),
        pre_request_script: folder.pre_request_script ?? '',
        post_request_script: folder.post_request_script ?? '',
        pre_request_scripts: folder.pre_request_scripts ?? [],
        post_request_scripts: folder.post_request_scripts ?? [],
        marker: folder.marker ?? null
      })),
      created_at: new Date().toISOString()
    };

    return {
      manifest,
      requests: exportData.requests,
      documents: (exportData.documents ?? []).map((document) => ({
        ...document,
        uuid: resolveImportUuid(document.uuid)
      }))
    };
  }

  /**
   * Converts a stored manifest into a Collection entity.
   *
   * @param id - Provider-local collection id.
   * @param manifest - Collection manifest.
   */
  private manifestToCollection(id: number, manifest: GitStoredManifest): Collection {
    const preRequestScript = manifest.pre_request_script;
    const postRequestScript = manifest.post_request_script;
    return {
      id,
      uuid: manifest.uuid,
      name: manifest.name,
      variables: manifest.variables,
      headers: manifest.headers,
      userAgent: manifest.userAgent ?? '',
      auth: normalizeAuth(manifest.auth ?? defaultAuth()),
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: manifest.pre_request_scripts,
      post_request_scripts: manifest.post_request_scripts,
      created_at: manifest.created_at,
      marker: manifest.marker ?? null
    };
  }

  /**
   * Builds Folder entities for a loaded collection.
   *
   * @param collectionId - Provider-local collection id.
   * @param loaded - Loaded collection state.
   */
  private buildFolders(collectionId: number, loaded: LoadedCollection): Folder[] {
    return loaded.manifest.folders
      .map((folder) => {
        const folderId = assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', folder.uuid);
        return this.storedFolderToFolder(collectionId, folder, folderId);
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  /**
   * Converts a stored folder row to a Folder entity.
   *
   * @param collectionId - Provider-local collection id.
   * @param folder - Stored folder row.
   * @param folderId - Numeric folder id.
   */
  private storedFolderToFolder(
    collectionId: number,
    folder: StoredFolderRow,
    folderId: number
  ): Folder {
    const preRequestScript = folder.pre_request_script ?? '';
    const postRequestScript = folder.post_request_script ?? '';
    const parentUuid = folder.parent_uuid?.trim();
    const parent_folder_id =
      parentUuid != null && parentUuid !== ''
        ? (this.#idIndex.folderIds[parentUuid] ?? null)
        : null;
    return {
      id: folderId,
      collection_id: collectionId,
      parent_folder_id,
      uuid: folder.uuid,
      name: folder.name,
      sort_order: folder.sort_order,
      variables: folder.variables ?? [],
      headers: folder.headers ?? [],
      userAgent: folder.userAgent ?? '',
      auth: folder.auth ?? defaultAuth(),
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: folder.pre_request_scripts ?? [],
      post_request_scripts: folder.post_request_scripts ?? [],
      created_at: new Date().toISOString(),
      marker: folder.marker ?? null
    };
  }

  /**
   * Converts an environment export to an Environment entity.
   *
   * @param id - Provider-local environment id.
   * @param env - Environment export payload.
   */
  private exportToEnvironment(id: number, env: EnvironmentExport): Environment {
    return {
      id,
      uuid: resolveImportUuid(env.uuid),
      name: env.name,
      variables: env.variables,
      created_at: new Date().toISOString(),
      marker: env.marker ?? null,
      parentUuid: env.parentUuid ?? null
    };
  }

  /**
   * Converts a snippet export to a Snippet entity.
   *
   * @param id - Provider-local snippet id.
   * @param snippet - Snippet export payload.
   */
  private exportToSnippet(id: number, snippet: SnippetExport): Snippet {
    const now = new Date().toISOString();
    return {
      id,
      uuid: resolveImportUuid(snippet.uuid),
      name: snippet.name,
      code: snippet.code,
      scope: snippet.scope,
      stage: snippet.stage,
      source: 'local',
      created_at: snippet.created_at ?? now,
      updated_at: snippet.updated_at ?? now
    };
  }

  /**
   * Converts a live-server export to the provider entity shape.
   *
   * @param id - Provider-local live server id.
   * @param server - Portable live-server export.
   */
  private exportToLiveServer(id: number, server: LiveServerExport): LiveServer {
    const uuid = resolveImportUuid(server.uuid);
    const requirement = normalizeRuntimeRequirement(server.runtime);
    const matchedRuntime =
      requirement != null ? findMatchingRuntime(listRuntimes(), requirement) : undefined;
    const payload = parseLiveServerPayload(
      serializeLiveServerPayload({
        name: server.name,
        root: server.root,
        port: server.port,
        aliases: server.aliases,
        watch: server.watch,
        cors: server.cors,
        openPath: server.openPath,
        openPathOnStartup: server.openPathOnStartup,
        rememberLastUrl: server.rememberLastUrl,
        lastOpenedPath: server.lastOpenedPath,
        indexFiles: server.indexFiles,
        host: server.host,
        headers: server.headers,
        routes: server.routes,
        errorPages: server.errorPages,
        proxies: server.proxies,
        ssl: server.ssl,
        runCommand: server.runCommand,
        runtimeId: matchedRuntime?.id ?? '',
        runCommandEnabled: server.runCommandEnabled,
        runCommandEnv: server.runCommandEnv,
        restartOnCrash: server.restartOnCrash,
        urlVariable: server.urlVariable,
        preRequestScripts: server.pre_request_scripts,
        postRequestScripts: server.post_request_scripts
      })
    );
    const timestamps = this.#liveServerTimestamps.get(uuid);
    const now = Date.now();
    return liveServerFromPayload(
      {
        id,
        uuid,
        name: server.name,
        sortOrder: id,
        createdAt: timestamps?.createdAt ?? now,
        updatedAt: timestamps?.updatedAt ?? now
      },
      payload
    );
  }

  /**
   * Converts a website export to the provider entity shape.
   *
   * @param id - Provider-local live page id.
   * @param page - Portable website export.
   */
  private exportToLivePage(id: number, page: WebsiteExport): Website {
    const uuid = resolveImportUuid(page.uuid);
    const payload = parseLivePagePayload(
      serializeLivePagePayload({
        name: page.name,
        url: page.url,
        homeUrl: page.homeUrl,
        faviconDataUrl: page.faviconDataUrl,
        scripts: page.scripts,
        preRequestScripts: page.pre_request_scripts,
        postRequestScripts: page.post_request_scripts,
        variables: page.variables,
        headers: page.headers,
        userAgent: page.userAgent,
        auth: page.auth
      })
    );
    const timestamps = this.#livePageTimestamps.get(uuid);
    const now = Date.now();
    return livePageFromPayload(
      {
        id,
        uuid,
        name: page.name,
        createdAt: timestamps?.createdAt ?? now,
        updatedAt: timestamps?.updatedAt ?? now
      },
      payload
    );
  }

  /**
   * Converts an exported request row to a SavedRequest entity.
   *
   * @param collectionId - Provider-local collection id.
   * @param request - Exported request row.
   * @param folderIdByName - Map of folder name to folder id.
   * @param folders - Stored folder rows.
   */
  private exportedRequestToSaved(
    collectionId: number,
    request: ExportedRequest,
    folderMaps: ReturnType<typeof buildFolderImportMaps>
  ): SavedRequest {
    const requestUuid = resolveImportUuid(request.uuid);
    const requestId = assignGitId(this.#idIndex, 'requestIds', 'nextRequestId', requestUuid);
    const folderId = resolveImportFolderId(
      request.folder_uuid,
      request.folder_name,
      folderMaps.folderIdByUuid,
      folderMaps.folderIdByName
    );
    const auth = normalizeAuth(request.auth ?? defaultAuth());
    const timestamps = this.#requestTimestamps.get(requestUuid);
    const now = new Date().toISOString();
    const created_at = timestamps?.created_at ?? now;
    const updated_at = timestamps?.updated_at ?? now;

    const preRequestScript = request.pre_request_script;
    const postRequestScript = request.post_request_script;

    return {
      id: requestId,
      uuid: requestUuid,
      collection_id: collectionId,
      folder_id: folderId,
      name: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers,
      userAgent: typeof request.userAgent === 'string' ? request.userAgent : '',
      params: request.params,
      auth,
      body: request.body,
      body_type: request.body_type,
      body_raw: request.body_raw ?? null,
      body_raw_open: request.body_raw_open === true,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: request.pre_request_scripts ?? [],
      post_request_scripts: request.post_request_scripts ?? [],
      comment: request.comment,
      tags: request.tags,
      sort_order: request.sort_order ?? 0,
      created_at,
      updated_at,
      marker: request.marker ?? null
    };
  }

  /**
   * Converts an exported document row to a CollectionDocument entity.
   *
   * @param collectionId - Provider-local collection id.
   * @param document - Exported document row.
   * @param folderMaps - Folder uuid and name indexes for placement resolution.
   */
  private exportedDocumentToSaved(
    collectionId: number,
    document: ExportedDocument,
    folderMaps: ReturnType<typeof buildFolderImportMaps>
  ): CollectionDocument {
    const documentUuid = resolveImportUuid(document.uuid);
    const documentId = assignGitId(this.#idIndex, 'documentIds', 'nextDocumentId', documentUuid);
    const folderId = resolveImportFolderId(
      document.folder_uuid,
      document.folder_name,
      folderMaps.folderIdByUuid,
      folderMaps.folderIdByName
    );
    const timestamps = this.#documentTimestamps.get(documentUuid);
    const now = new Date().toISOString();
    const created_at = timestamps?.created_at ?? now;
    const updated_at = timestamps?.updated_at ?? now;

    return {
      id: documentId,
      uuid: documentUuid,
      collection_id: collectionId,
      folder_id: folderId,
      name: document.name,
      content: document.content,
      sort_order: document.sort_order ?? 0,
      created_at,
      updated_at,
      marker: document.marker ?? null
    };
  }
}
