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
  collectionDirPath,
  collectionManifestPath,
  createStoredFolder,
  deleteEnvironmentFile,
  deleteSnippetFile,
  ensureHarborclientLayout,
  listCollectionFoldersOnDisk,
  readAllEnvironments,
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
  writeSnippetFile,
  type StoredFolderRow
} from '#/main/git/fileLayout';
import { deriveRequestFileStatus, isCountedCollectionChange } from '#/main/git/gitRequestStatus';
import { GitSyncManager } from '#/main/git/GitSyncManager';
import { maskVariablesForExport, validateCollectionExport } from './collectionData';
import { trimRequiredName } from './trimRequiredName';
import { assertContainerItemOrder, planContainerItemMove } from './containerReorder';
import type { ContainerItemRef } from '#/shared/collectionContainerOrder';
import type { IStorage } from './IStorage';
import type {
  ProviderRunResult,
  ProviderRunResultSummary,
  SaveRunResultInput
} from '#/shared/collectionRunner';
import { generateDocumentUuid, resolveImportUuid } from './uuid';
import {
  buildDocumentUuidIndex,
  buildFolderImportMaps,
  buildRequestUuidIndex,
  importedFolderToStoredRow,
  resolveImportFolderId,
  serializeImportedCollectionScriptFields,
  serializeImportedDocumentFields,
  serializeImportedRequestFields
} from './collectionImport';
import { serializeSidebarColor } from './sidebarColorMigration';
import { defaultAuth, normalizeAuth } from '#/shared/auth';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExport,
  Environment,
  EnvironmentExport,
  ExportedDocument,
  ExportedRequest,
  Folder,
  GitSettings,
  GitRequestFileStatus,
  KeyValue,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  SnippetExport,
  SourceControlStatus,
  Variable
} from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '#/shared/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';

/**
 * Collection metadata held in memory for one git-backed collection file.
 */
type GitStoredManifest = {
  harborclientVersion: 1;
  harborclientExport: 'collection';
  uuid: string;
  name: string;
  color?: string | null;
  variables: Variable[];
  headers: KeyValue[];
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
    color: loaded.manifest.color ?? null,
    variables: loaded.manifest.variables,
    headers: loaded.manifest.headers,
    auth: loaded.manifest.auth,
    pre_request_script: loaded.manifest.pre_request_script,
    post_request_script: loaded.manifest.post_request_script,
    pre_request_scripts: loaded.manifest.pre_request_scripts,
    post_request_scripts: loaded.manifest.post_request_scripts,
    folders: loaded.manifest.folders.map((folder) => ({
      uuid: folder.uuid,
      name: folder.name,
      sort_order: folder.sort_order,
      variables: folder.variables ?? [],
      headers: folder.headers ?? [],
      auth: folder.auth ?? defaultAuth(),
      pre_request_script: folder.pre_request_script ?? '',
      post_request_script: folder.post_request_script ?? '',
      pre_request_scripts: folder.pre_request_scripts ?? [],
      post_request_scripts: folder.post_request_scripts ?? [],
      color: folder.color ?? null
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
  #requestTimestamps = new Map<string, { created_at: string; updated_at: string }>();
  #documentTimestamps = new Map<string, { created_at: string; updated_at: string }>();
  #providerSettings: Record<string, string> = {};
  #initialized = false;

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
    return this.manifestToCollection(id, manifest);
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
  async setCollectionColor(id: number, color: string | null): Promise<Collection> {
    const loaded = this.requireCollection(id);
    loaded.manifest = {
      ...loaded.manifest,
      color: serializeSidebarColor(color)
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
  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const existing = this.#environments.get(id);
    if (!existing) {
      throw new Error('Environment not found');
    }
    const trimmedName = trimRequiredName(name, 'Environment name');
    const updated: EnvironmentExport = {
      ...existing,
      name: trimmedName,
      variables
    };
    deleteEnvironmentFile(this.#root, updated.uuid!);
    writeEnvironmentFile(this.#root, updated);
    this.#environments.set(id, updated);
    return this.exportToEnvironment(id, updated);
  }

  /**
   * @inheritdoc
   */
  async setEnvironmentColor(id: number, color: string | null): Promise<Environment> {
    const existing = this.#environments.get(id);
    if (!existing) {
      throw new Error('Environment not found');
    }
    const updated: EnvironmentExport = {
      ...existing,
      color: serializeSidebarColor(color)
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
    deleteEnvironmentFile(this.#root, resolveImportUuid(existing.uuid));
    delete this.#idIndex.environmentIds[resolveImportUuid(existing.uuid)];
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
      params: input.params,
      auth: input.auth,
      body: input.body,
      body_type: input.body_type,
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
      color:
        input.color !== undefined
          ? serializeSidebarColor(input.color)
          : (existingRequest?.color ?? null)
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
  async setRequestColor(id: number, color: string | null): Promise<SavedRequest> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const request = loaded.requests.find(
        (row) => this.#idIndex.requestIds[resolveImportUuid(row.uuid)] === id
      );
      if (!request) {
        continue;
      }

      request.color = serializeSidebarColor(color);
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
  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const loaded = this.requireCollection(collectionId);
    const trimmedName = trimRequiredName(name, 'Folder name');
    const sort_order = loaded.manifest.folders.length;
    const folder = createStoredFolder(trimmedName, sort_order);
    loaded.manifest.folders.push(folder);
    const folderId = assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', folder.uuid);
    this.persistCollection(collectionId);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
    return this.storedFolderToFolder(collectionId, folder, folderId);
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
  async setFolderColor(id: number, color: string | null): Promise<Folder> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const folder = loaded.manifest.folders.find(
        (row) => this.#idIndex.folderIds[row.uuid] === id
      );
      if (!folder) {
        continue;
      }

      folder.color = serializeSidebarColor(color);
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
      if (folder) {
        const folderName = folder.name;
        loaded.manifest.folders = loaded.manifest.folders.filter((row) => row.uuid !== folder.uuid);
        delete this.#idIndex.folderIds[folder.uuid];
        loaded.requests = loaded.requests.filter((request) => request.folder_name !== folderName);
        for (const document of loaded.documents) {
          if (
            document.folder_uuid === folder.uuid ||
            (document.folder_name ?? null) === folderName
          ) {
            const documentUuid = resolveImportUuid(document.uuid);
            delete this.#idIndex.documentIds[documentUuid];
            this.#documentTimestamps.delete(documentUuid);
          }
        }
        loaded.documents = loaded.documents.filter(
          (document) =>
            document.folder_uuid !== folder.uuid && (document.folder_name ?? null) !== folderName
        );
        this.persistCollection(collectionId);
        saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);
        return;
      }
    }
    throw new Error('Folder not found');
  }

  /**
   * @inheritdoc
   */
  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
    const loaded = this.requireCollection(collectionId);
    const idToFolder = new Map(
      loaded.manifest.folders.map((folder) => [this.#idIndex.folderIds[folder.uuid], folder])
    );
    const reordered: StoredFolderRow[] = [];
    for (let index = 0; index < orderedFolderIds.length; index++) {
      const folder = idToFolder.get(orderedFolderIds[index]);
      if (folder) {
        folder.sort_order = index;
        reordered.push(folder);
      }
    }
    loaded.manifest.folders = reordered;
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
      color:
        input.color !== undefined
          ? serializeSidebarColor(input.color)
          : (existingDocument?.color ?? null)
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
  async setDocumentColor(id: number, color: string | null): Promise<CollectionDocument> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const document = loaded.documents.find(
        (row) => this.#idIndex.documentIds[resolveImportUuid(row.uuid)] === id
      );
      if (!document) {
        continue;
      }

      document.color = serializeSidebarColor(color);
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
      color: serializeSidebarColor(exportData.color),
      variables: exportData.variables,
      headers: exportData.headers,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: exportData.pre_request_scripts ?? [],
      post_request_scripts: exportData.post_request_scripts ?? [],
      folders: (exportData.folders ?? []).map((folder, index) =>
        importedFolderToStoredRow(folder, index)
      ),
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
    const folderMaps = buildFolderImportMaps(this.buildFolders(id, loaded));

    const collectionScripts = serializeImportedCollectionScriptFields(exportData);
    loaded.manifest = {
      ...loaded.manifest,
      name: exportData.name,
      color: serializeSidebarColor(exportData.color),
      variables: exportData.variables,
      headers: exportData.headers,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: exportData.pre_request_scripts ?? [],
      post_request_scripts: exportData.post_request_scripts ?? []
    };

    for (const folder of exportData.folders ?? []) {
      const folderUuid = resolveImportUuid(folder.uuid);
      const existingByUuid = loaded.manifest.folders.find((row) => row.uuid === folderUuid);
      const existingByName = loaded.manifest.folders.find((row) => row.name === folder.name);
      const existing = existingByUuid ?? existingByName;

      if (existing) {
        Object.assign(existing, importedFolderToStoredRow(folder, existing.sort_order));
        assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', existing.uuid);
        continue;
      }

      const stored = importedFolderToStoredRow(folder, loaded.manifest.folders.length);
      loaded.manifest.folders.push(stored);
      assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', stored.uuid);
    }

    const requestUuidIndex = buildRequestUuidIndex(await this.listRequests(id));
    const documentUuidIndex = buildDocumentUuidIndex(await this.listDocuments(id));

    for (const request of exportData.requests) {
      const fields = serializeImportedRequestFields(request);
      const folderId = resolveImportFolderId(
        request.folder_uuid,
        request.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const folderName =
        folderId != null
          ? loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)?.name
          : request.folder_name;

      const exported: ExportedRequest = {
        ...request,
        uuid: fields.uuid,
        name: fields.name,
        method: fields.method,
        url: fields.url,
        headers: JSON.parse(fields.headersJson),
        params: JSON.parse(fields.paramsJson),
        auth: JSON.parse(fields.authJson),
        body: fields.body,
        body_type: fields.body_type,
        pre_request_script: fields.pre_request_script,
        post_request_script: fields.post_request_script,
        pre_request_scripts: request.pre_request_scripts ?? [],
        post_request_scripts: request.post_request_scripts ?? [],
        comment: fields.comment,
        tags: fields.tags,
        sort_order: fields.sort_order,
        folder_name: folderName ?? request.folder_name ?? null,
        color: fields.color
      };

      const existingRequestId = requestUuidIndex.get(fields.uuid);
      const existingIndex = loaded.requests.findIndex(
        (row) => resolveImportUuid(row.uuid) === fields.uuid
      );
      if (existingIndex >= 0) {
        loaded.requests[existingIndex] = exported;
      } else if (existingRequestId != null) {
        loaded.requests.push(exported);
      } else {
        loaded.requests.push(exported);
      }
      assignGitId(this.#idIndex, 'requestIds', 'nextRequestId', fields.uuid);
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
        color: fields.color
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
   * Returns the number of changed request and document files in one collection,
   * including deletions that {@link getItemGitStatuses} cannot map to item uuids.
   *
   * @param collectionId - Provider-local collection id.
   */
  async getChangedItemCount(collectionId: number): Promise<number> {
    const loaded = this.requireCollection(collectionId);
    const collectionPrefix = this.toRepoRelativePath(loaded.dirPath);
    const pathFlags = await this.#sync.getPathFlagsUnderPrefix(collectionPrefix);
    let count = 0;

    for (const [repoPath, flags] of Object.entries(pathFlags)) {
      const rel = repoPath.slice(collectionPrefix.length + 1);
      if (isCollectionRequestOrDocumentFile(rel) && isCountedCollectionChange(flags)) {
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
      map.set(uuid, this.toRepoRelativePath(join(loaded.dirPath, document.file)));
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
    const targetDirPath = collectionDirPath(this.#root, loaded.manifest.name);
    loaded.dirPath = writeCollectionToFolder(this.#root, buildCollectionExportFromLoaded(loaded), {
      previousDirPath: oldDirPath !== targetDirPath ? oldDirPath : null
    });
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
      color: exportData.color ?? null,
      variables: exportData.variables,
      headers: exportData.headers,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: exportData.pre_request_script,
      post_request_script: exportData.post_request_script,
      pre_request_scripts: exportData.pre_request_scripts ?? [],
      post_request_scripts: exportData.post_request_scripts ?? [],
      folders: (exportData.folders ?? []).map((folder, index) => ({
        uuid: resolveImportUuid(folder.uuid),
        name: folder.name,
        sort_order: folder.sort_order ?? index,
        variables: folder.variables ?? [],
        headers: folder.headers ?? [],
        auth: folder.auth ?? defaultAuth(),
        pre_request_script: folder.pre_request_script ?? '',
        post_request_script: folder.post_request_script ?? '',
        pre_request_scripts: folder.pre_request_scripts ?? [],
        post_request_scripts: folder.post_request_scripts ?? [],
        color: folder.color ?? null
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
      auth: normalizeAuth(manifest.auth ?? defaultAuth()),
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: manifest.pre_request_scripts,
      post_request_scripts: manifest.post_request_scripts,
      created_at: manifest.created_at,
      color: manifest.color ?? null
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
    return {
      id: folderId,
      collection_id: collectionId,
      uuid: folder.uuid,
      name: folder.name,
      sort_order: folder.sort_order,
      variables: folder.variables ?? [],
      headers: folder.headers ?? [],
      auth: folder.auth ?? defaultAuth(),
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: folder.pre_request_scripts ?? [],
      post_request_scripts: folder.post_request_scripts ?? [],
      created_at: new Date().toISOString(),
      color: folder.color ?? null
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
      color: env.color ?? null
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
      params: request.params,
      auth,
      body: request.body,
      body_type: request.body_type,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: request.pre_request_scripts ?? [],
      post_request_scripts: request.post_request_scripts ?? [],
      comment: request.comment,
      tags: request.tags,
      sort_order: request.sort_order ?? 0,
      created_at,
      updated_at,
      color: request.color ?? null
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
      color: document.color ?? null
    };
  }
}
