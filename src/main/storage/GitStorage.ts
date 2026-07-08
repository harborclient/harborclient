import { rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  assignGitId,
  loadGitIdIndex,
  pruneGitIdMap,
  saveGitIdIndex,
  type GitIdIndexData
} from '#/main/git/idIndex';
import {
  collectionDir,
  createStoredFolder,
  deleteEnvironmentFile,
  deleteSnippetFile,
  ensureHarborclientLayout,
  findCollectionDirByUuid,
  listCollectionUuidsOnDisk,
  manifestToCollectionExport,
  readAllEnvironments,
  readAllSnippets,
  readCollectionFromDir,
  readGitProviderSettings,
  resolveHarborclientRoot,
  writeCollectionToDir,
  writeEnvironmentFile,
  writeGitProviderSettings,
  writeSnippetFile,
  type CollectionManifest,
  type StoredFolderRow
} from '#/main/git/fileLayout';
import { GitSyncManager } from '#/main/git/GitSyncManager';
import { uuidSlugPrefix } from '#/main/git/slug';
import { maskVariablesForExport, validateCollectionExport } from '#/main/storage/collectionData';
import { bundleScriptFieldsWithLegacy } from '#/main/storage/scriptFields';
import { readScriptRefsFromJson } from '#/shared/scriptRefs';
import { trimRequiredName } from '#/main/storage/trimRequiredName';
import type { IStorage } from '#/main/storage/IStorage';
import type {
  ProviderRunResult,
  ProviderRunResultSummary,
  SaveRunResultInput
} from '#/shared/collectionRunner';
import { generateDocumentUuid, resolveImportUuid } from '#/main/storage/uuid';
import {
  buildFolderImportMaps,
  buildRequestUuidIndex,
  resolveImportFolderId,
  serializeImportedCollectionScriptFields,
  serializeImportedRequestFields
} from '#/main/storage/collectionImport';
import { defaultAuth, normalizeAuth } from '#/shared/auth';
import type {
  AuthConfig,
  Collection,
  CollectionExport,
  Environment,
  EnvironmentExport,
  ExportedRequest,
  Folder,
  GitSettings,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  SnippetExport,
  SourceControlStatus,
  Variable
} from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';

/**
 * Collection manifest persisted on disk including script array JSON columns.
 */
type GitStoredManifest = CollectionManifest & {
  pre_request_scripts?: string;
  post_request_scripts?: string;
};

/**
 * Request export row persisted on disk including script array JSON columns.
 */
type GitStoredRequest = Omit<
  CollectionExport['requests'][number],
  'pre_request_scripts' | 'post_request_scripts'
> & {
  pre_request_scripts?: string;
  post_request_scripts?: string;
};

/**
 * Converts a Git on-disk request row into a portable export shape.
 *
 * @param request - Request row loaded from Git storage.
 * @returns Export-friendly request payload.
 */
function gitStoredRequestToExported(request: GitStoredRequest): ExportedRequest {
  const { pre_request_scripts, post_request_scripts, ...rest } = request;
  return {
    ...rest,
    pre_request_scripts: readScriptRefsFromJson(pre_request_scripts, rest.pre_request_script),
    post_request_scripts: readScriptRefsFromJson(post_request_scripts, rest.post_request_script)
  };
}

/**
 * Converts a portable export request into Git on-disk storage fields.
 *
 * @param request - Export-friendly request payload.
 * @returns Git stored request row.
 */
function exportedRequestToGitStored(request: ExportedRequest): GitStoredRequest {
  const preScripts = bundleScriptFieldsWithLegacy(
    request.pre_request_scripts,
    request.pre_request_script
  );
  const postScripts = bundleScriptFieldsWithLegacy(
    request.post_request_scripts,
    request.post_request_script
  );
  return {
    ...request,
    pre_request_script: preScripts.legacy,
    post_request_script: postScripts.legacy,
    pre_request_scripts: preScripts.json,
    post_request_scripts: postScripts.json
  };
}

interface LoadedCollection {
  /**
   * Absolute path to the collection directory on disk.
   */
  dir: string;

  /**
   * Parsed collection manifest.
   */
  manifest: GitStoredManifest;

  /**
   * Request export rows for this collection.
   */
  requests: GitStoredRequest[];
}

/**
 * Git-backed IStorage implementation storing collections as files in a repository.
 */
export class GitStorage implements IStorage {
  readonly #connectionId: string;
  readonly #userDataPath: string;
  readonly #root: string;
  readonly #sync: GitSyncManager;
  #idIndex: GitIdIndexData;
  #collections = new Map<number, LoadedCollection>();
  #environments = new Map<number, EnvironmentExport>();
  #snippets = new Map<number, SnippetExport>();
  #requestTimestamps = new Map<string, { created_at: string; updated_at: string }>();
  #providerSettings: Record<string, string> = {};
  #initialized = false;

  /**
   * @param connectionId - Git connection id for auth and id index persistence.
   * @param settings - Git connection settings.
   * @param userDataPath - Electron userData path for id index and provider settings.
   */
  constructor(connectionId: string, settings: GitSettings, userDataPath: string) {
    this.#connectionId = connectionId;
    this.#userDataPath = userDataPath;
    this.#root = resolveHarborclientRoot(settings.repoPath, settings.subdir);
    this.#sync = new GitSyncManager(connectionId, settings);
    this.#idIndex = loadGitIdIndex(userDataPath, connectionId);
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
    for (const uuid of listCollectionUuidsOnDisk(this.#root)) {
      collectionUuids.add(uuid);
      const dir = findCollectionDirByUuid(this.#root, uuid);
      if (!dir) {
        continue;
      }
      const { manifest, requests } = this.loadCollectionFromDir(dir);
      const collectionId = assignGitId(
        this.#idIndex,
        'collectionIds',
        'nextCollectionId',
        manifest.uuid
      );
      this.#collections.set(collectionId, { dir, manifest, requests });

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
      pre_request_scripts: '[]',
      post_request_scripts: '[]',
      folders: [],
      created_at: new Date().toISOString()
    };
    const dir = collectionDir(this.#root, uuid, trimmedName);
    writeCollectionToDir(dir, manifest, []);
    const id = assignGitId(this.#idIndex, 'collectionIds', 'nextCollectionId', uuid);
    this.#collections.set(id, { dir, manifest, requests: [] });
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
    const preScripts = bundleScriptFieldsWithLegacy(preRequestScripts, preRequestScript);
    const postScripts = bundleScriptFieldsWithLegacy(postRequestScripts, postRequestScript);
    const oldDir = loaded.dir;
    loaded.manifest = {
      ...loaded.manifest,
      name: trimmedName,
      variables,
      headers,
      auth: normalizeAuth(auth),
      pre_request_script: preScripts.legacy,
      post_request_script: postScripts.legacy,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json
    };

    const newDir = collectionDir(this.#root, loaded.manifest.uuid, trimmedName);
    if (newDir !== oldDir) {
      loaded.dir = newDir;
    }
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
    for (const folder of loaded.manifest.folders) {
      delete this.#idIndex.folderIds[folder.uuid];
    }
    delete this.#idIndex.collectionIds[loaded.manifest.uuid];
    rmSync(loaded.dir, { recursive: true, force: true });
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
    uuid?: string
  ): Promise<Snippet> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const snippetUuid = uuid?.trim() || generateDocumentUuid();
    const now = new Date().toISOString();
    const exportData: SnippetExport = {
      harborclientVersion: 1,
      harborclientExport: 'snippet',
      uuid: snippetUuid,
      name: trimmedName,
      code: code ?? '',
      scope,
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
    scope: SnippetScope = 'any'
  ): Promise<Snippet> {
    const existing = this.#snippets.get(id);
    if (!existing) {
      throw new Error('Snippet not found');
    }
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const now = new Date().toISOString();
    const updated: SnippetExport = {
      ...existing,
      name: trimmedName,
      code: code ?? '',
      scope,
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

    const preScripts = bundleScriptFieldsWithLegacy(
      input.pre_request_scripts,
      input.pre_request_script ?? ''
    );
    const postScripts = bundleScriptFieldsWithLegacy(
      input.post_request_scripts,
      input.post_request_script ?? ''
    );
    const preRequestScript = preScripts.legacy;
    const postRequestScript = postScripts.legacy;
    const tags = input.tags ?? '';

    const exported: GitStoredRequest = {
      uuid: requestUuid,
      name: trimmedName,
      method: input.method,
      url: input.url,
      headers: input.headers,
      params: input.params,
      auth: input.auth,
      body: input.body,
      body_type: input.body_type,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json,
      comment: input.comment,
      tags,
      sort_order:
        loaded.requests.find((r) => resolveImportUuid(r.uuid) === requestUuid)?.sort_order ??
        loaded.requests.filter((row) => (row.folder_name ?? null) === (folderName ?? null)).length,
      folder_name: folderName,
      folder_uuid: folderUuid
    };

    const index = loaded.requests.findIndex((row) => resolveImportUuid(row.uuid) === requestUuid);
    if (index >= 0) {
      loaded.requests[index] = exported;
    } else {
      loaded.requests.push(exported);
    }

    this.persistCollection(input.collection_id);
    saveGitIdIndex(this.#userDataPath, this.#connectionId, this.#idIndex);

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
        this.persistCollection(collectionId);
        return this.storedFolderToFolder(collectionId, folder, id);
      }
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
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    for (const [collectionId, loaded] of this.#collections.entries()) {
      const request = loaded.requests.find(
        (row) => this.#idIndex.requestIds[resolveImportUuid(row.uuid)] === requestId
      );
      if (!request) {
        continue;
      }

      const targetFolder =
        folderId != null
          ? loaded.manifest.folders.find((f) => this.#idIndex.folderIds[f.uuid] === folderId)
          : undefined;
      if (folderId != null && !targetFolder) {
        throw new Error('Folder not found');
      }

      const targetFolderName = targetFolder?.name ?? null;
      request.folder_name = targetFolderName;
      request.folder_uuid = targetFolder?.uuid ?? null;

      const targetContainer = loaded.requests.filter(
        (row) => row !== request && (row.folder_name ?? null) === targetFolderName
      );
      targetContainer.splice(index, 0, request);
      for (let i = 0; i < targetContainer.length; i++) {
        targetContainer[i].sort_order = i;
      }

      const remaining = loaded.requests.filter(
        (row) => row !== request && (row.folder_name ?? null) !== targetFolderName
      );
      loaded.requests = [...remaining, ...targetContainer];
      this.persistCollection(collectionId);
      return;
    }
    throw new Error('Request not found');
  }

  /**
   * @inheritdoc
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const loaded = this.requireCollection(id);
    return manifestToCollectionExport(
      {
        ...loaded.manifest,
        variables: maskVariablesForExport(loaded.manifest.variables)
      },
      loaded.requests.map(gitStoredRequestToExported)
    );
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
      variables: exportData.variables,
      headers: exportData.headers,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: collectionScripts.pre_request_scripts_json,
      post_request_scripts: collectionScripts.post_request_scripts_json,
      folders: (exportData.folders ?? []).map((folder, index) => ({
        uuid: resolveImportUuid(folder.uuid),
        name: folder.name,
        sort_order: folder.sort_order ?? index
      })),
      created_at: new Date().toISOString()
    };
    const dir = collectionDir(this.#root, uuid, manifest.name);
    const gitRequests = exportData.requests.map(exportedRequestToGitStored);
    this.writeGitCollectionToDir(dir, manifest, gitRequests);
    const id = assignGitId(this.#idIndex, 'collectionIds', 'nextCollectionId', uuid);
    this.#collections.set(id, {
      dir,
      manifest,
      requests: gitRequests
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
      variables: exportData.variables,
      headers: exportData.headers,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: collectionScripts.pre_request_scripts_json,
      post_request_scripts: collectionScripts.post_request_scripts_json
    };

    for (const folder of exportData.folders ?? []) {
      const folderUuid = resolveImportUuid(folder.uuid);
      const existingByUuid = loaded.manifest.folders.find((row) => row.uuid === folderUuid);
      const existingByName = loaded.manifest.folders.find((row) => row.name === folder.name);
      const existing = existingByUuid ?? existingByName;

      if (existing) {
        existing.name = folder.name;
        existing.sort_order = folder.sort_order;
        existing.uuid = folderUuid;
        assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', existing.uuid);
        continue;
      }

      const stored = {
        uuid: folderUuid,
        name: folder.name,
        sort_order: folder.sort_order
      };
      loaded.manifest.folders.push(stored);
      assignGitId(this.#idIndex, 'folderIds', 'nextFolderId', stored.uuid);
    }

    const requestUuidIndex = buildRequestUuidIndex(await this.listRequests(id));

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

      const exported = exportedRequestToGitStored({
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
        comment: fields.comment,
        tags: fields.tags,
        sort_order: fields.sort_order,
        folder_name: folderName ?? request.folder_name ?? null
      });

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
   * Writes collection manifest and requests to disk.
   *
   * @param collectionId - Provider-local collection id.
   */
  private persistCollection(collectionId: number): void {
    const loaded = this.requireCollection(collectionId);
    const newDir = collectionDir(this.#root, loaded.manifest.uuid, loaded.manifest.name);
    if (newDir !== loaded.dir) {
      this.writeGitCollectionToDir(newDir, loaded.manifest, loaded.requests);
      if (loaded.dir !== newDir) {
        rmSync(loaded.dir, { recursive: true, force: true });
      }
      loaded.dir = newDir;
    } else {
      this.writeGitCollectionToDir(loaded.dir, loaded.manifest, loaded.requests);
    }
  }

  /**
   * Reads a collection directory including script array JSON fields omitted by
   * {@link readCollectionFromDir}.
   *
   * @param dir - Absolute path to the collection directory.
   */
  private loadCollectionFromDir(dir: string): {
    manifest: GitStoredManifest;
    requests: GitStoredRequest[];
  } {
    const { manifest, requests } = readCollectionFromDir(dir);
    const rawManifest = JSON.parse(readFileSync(join(dir, 'collection.json'), 'utf-8')) as Record<
      string,
      unknown
    >;
    const requestsDir = join(dir, 'requests');
    const scriptByUuid = new Map<string, { pre: string; post: string }>();

    if (existsSync(requestsDir)) {
      for (const fileName of readdirSync(requestsDir)) {
        if (!fileName.endsWith('.json')) {
          continue;
        }
        const parsed = JSON.parse(readFileSync(join(requestsDir, fileName), 'utf-8')) as Record<
          string,
          unknown
        >;
        const uuid = typeof parsed.uuid === 'string' ? parsed.uuid.trim() : '';
        if (!uuid) {
          continue;
        }
        scriptByUuid.set(uuid, {
          pre: typeof parsed.pre_request_scripts === 'string' ? parsed.pre_request_scripts : '[]',
          post: typeof parsed.post_request_scripts === 'string' ? parsed.post_request_scripts : '[]'
        });
      }
    }

    return {
      manifest: {
        ...manifest,
        pre_request_scripts:
          typeof rawManifest.pre_request_scripts === 'string'
            ? rawManifest.pre_request_scripts
            : '[]',
        post_request_scripts:
          typeof rawManifest.post_request_scripts === 'string'
            ? rawManifest.post_request_scripts
            : '[]'
      },
      requests: requests.map((request) => {
        const uuid = resolveImportUuid(request.uuid);
        const scripts = scriptByUuid.get(uuid);
        return {
          ...request,
          pre_request_scripts: scripts?.pre ?? '[]',
          post_request_scripts: scripts?.post ?? '[]'
        };
      })
    };
  }

  /**
   * Writes collection files and merges script array JSON into request documents.
   *
   * @param dir - Collection directory path.
   * @param manifest - Collection manifest including script JSON columns.
   * @param requests - Request rows including script JSON columns.
   */
  private writeGitCollectionToDir(
    dir: string,
    manifest: GitStoredManifest,
    requests: GitStoredRequest[]
  ): void {
    writeCollectionToDir(dir, manifest, requests.map(gitStoredRequestToExported));
    const requestsDir = join(dir, 'requests');
    if (!existsSync(requestsDir)) {
      return;
    }

    for (const request of requests) {
      const uuid = resolveImportUuid(request.uuid);
      const fileName = `${uuidSlugPrefix(uuid, request.name)}.json`;
      const filePath = join(requestsDir, fileName);
      if (!existsSync(filePath)) {
        continue;
      }
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      writeFileSync(
        filePath,
        JSON.stringify(
          {
            ...parsed,
            pre_request_scripts: request.pre_request_scripts ?? '[]',
            post_request_scripts: request.post_request_scripts ?? '[]'
          },
          null,
          2
        ),
        'utf-8'
      );
    }
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
      pre_request_scripts: readScriptRefsFromJson(manifest.pre_request_scripts, preRequestScript),
      post_request_scripts: readScriptRefsFromJson(
        manifest.post_request_scripts,
        postRequestScript
      ),
      created_at: manifest.created_at
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
    return {
      id: folderId,
      collection_id: collectionId,
      uuid: folder.uuid,
      name: folder.name,
      sort_order: folder.sort_order,
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
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
    request: GitStoredRequest,
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
      pre_request_scripts: readScriptRefsFromJson(request.pre_request_scripts, preRequestScript),
      post_request_scripts: readScriptRefsFromJson(request.post_request_scripts, postRequestScript),
      comment: request.comment,
      tags: request.tags,
      sort_order: request.sort_order ?? 0,
      created_at,
      updated_at
    };
  }
}
