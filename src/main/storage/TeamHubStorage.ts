import {
  buildDocumentUuidIndex,
  buildFolderImportMaps,
  buildRequestUuidIndex,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportedFolderUuid,
  importedRequestScriptFields,
  savedDocumentToExportedDocument,
  savedRequestToExportedRequest,
  exportedFolderFromFolder,
  resolveImportedFolderSettings,
  serializeImportedDocumentFields,
  serializeImportedRequestFields
} from './collectionImport';
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport,
  validateRunResultsExport
} from './collectionData';
import { saveRunResultInputSchema } from './collectionSchemas';
import {
  bundleScriptFieldsWithLegacy,
  teamHubScriptColumn,
  teamHubScriptRefsFromColumn
} from './scriptFields';
import type { TeamHubIdMap } from './TeamHubIdMap';
import type { TeamHubFolderSettings } from './TeamHubFolderSettings';
import {
  asTeamHubRunResultClient,
  type TeamHubRunResultDetail,
  type TeamHubRunResultRecord
} from './teamHubRunResultApi';
import { trimRequiredName } from './trimRequiredName';
import { resolveImportUuid } from './uuid';
import { serializeSidebarColor } from './sidebarColorMigration';
import { assertContainerItemOrder, planContainerItemMove } from './containerReorder';
import type { ContainerItemRef } from '#/shared/collectionContainerOrder';
import type { IStorage } from './IStorage';
import {
  toTeamHubAuth,
  TeamHubClientError,
  type CollectionRecord,
  type DocumentRecord,
  type EnvironmentRecord,
  type FolderRecord,
  type SavedRequestRecord,
  type SnippetRecord,
  type TeamHubAuthConfig,
  type TeamHubClient
} from '@harborclient/team-hub-api';
import { defaultAuth, normalizeAuth } from '#/shared/auth';
import {
  firstRunResultMethod,
  type ProviderRunResult,
  type ProviderRunResultSummary,
  type SaveRunResultInput
} from '#/shared/collectionRunner';
import { readScriptRefsFromJson, resolveScriptRefs } from '#/shared/scriptRefs';
import { normalizeRequestTags } from '#/shared/requestTags';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExport,
  Environment,
  ExportedFolder,
  Folder,
  KeyValue,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  Variable
} from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '#/shared/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';

/**
 * Resolves script references from a Team Hub record, preferring the legacy string column.
 *
 * @param scriptColumn - `preRequestScript` or `postRequestScript` from the server.
 * @param extendedJson - Optional JSON array column when the server supports it.
 * @returns Canonical script reference list.
 */
function resolveTeamHubScriptRefs(
  scriptColumn: string | undefined | null,
  extendedJson: string | undefined | null
): ScriptRef[] {
  const fromColumn = teamHubScriptRefsFromColumn(scriptColumn);
  if (fromColumn.length > 0) {
    return fromColumn;
  }
  return readScriptRefsFromJson(extendedJson, scriptColumn ?? '');
}

/**
 * Normalizes optional color fields returned by Team Hub APIs.
 *
 * @param value - Raw server value.
 * @returns Normalized sidebar color.
 */
function readTeamHubColor(value: unknown): string | null {
  return serializeSidebarColor(typeof value === 'string' ? value : null);
}

/**
 * Maps a server collection record to the local {@link Collection} shape.
 *
 * @param record - Collection payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 */
function serverToCollection(record: CollectionRecord, localId: number): Collection {
  const extended = record as CollectionRecord & {
    preRequestScripts?: string;
    postRequestScripts?: string;
    pre_request_scripts?: string;
    post_request_scripts?: string;
  };
  const preRequestScript = record.preRequestScript;
  const postRequestScript = record.postRequestScript;
  return {
    id: localId,
    uuid: record.id,
    name: record.name,
    variables: record.variables.map(normalizeVariable),
    headers: record.headers,
    auth: normalizeAuth(record.auth),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts: resolveTeamHubScriptRefs(
      preRequestScript,
      extended.pre_request_scripts ?? extended.preRequestScripts
    ),
    post_request_scripts: resolveTeamHubScriptRefs(
      postRequestScript,
      extended.post_request_scripts ?? extended.postRequestScripts
    ),
    created_at: record.createdAt,
    deletion_locked: record.deletionLocked,
    color: readTeamHubColor(record.color)
  };
}

/**
 * Maps a server environment record to the local {@link Environment} shape.
 *
 * @param record - Environment payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 */
function serverToEnvironment(record: EnvironmentRecord, localId: number): Environment {
  return {
    id: localId,
    uuid: record.id,
    name: record.name,
    variables: record.variables.map(normalizeVariable),
    created_at: record.createdAt,
    deletion_locked: record.deletionLocked,
    color: readTeamHubColor(record.color)
  };
}

/**
 * Maps a server snippet record to the local {@link Snippet} shape.
 *
 * @param record - Snippet payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 */
function serverToSnippet(record: SnippetRecord, localId: number): Snippet {
  return {
    id: localId,
    uuid: record.id,
    name: record.name,
    code: record.code,
    scope: record.scope,
    stage: normalizeScriptStage((record as { stage?: string }).stage),
    source: 'local',
    created_at: record.createdAt,
    updated_at: record.createdAt
  };
}

/**
 * Maps a Team Hub run result list row to provider-local summary metadata.
 *
 * @param record - Run result payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 */
function serverToRunResultSummary(
  record: TeamHubRunResultRecord,
  localId: number
): ProviderRunResultSummary {
  let firstRequestMethod: ProviderRunResultSummary['firstRequestMethod'] = null;
  if ('payload' in record && record.payload != null) {
    try {
      firstRequestMethod = firstRunResultMethod(
        validateRunResultsExport(record.payload as TeamHubRunResultDetail['payload'])
      );
    } catch {
      firstRequestMethod = null;
    }
  }

  return {
    id: localId,
    uuid: record.id,
    label: record.label,
    kind: record.kind,
    collectionName: record.collectionName,
    requestName: record.requestName,
    summary: record.summary,
    firstRequestMethod,
    createdAt: record.createdAt
  };
}

/**
 * Maps a Team Hub run result detail row to a provider-local snapshot.
 *
 * @param record - Run result payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 */
function serverToRunResult(record: TeamHubRunResultDetail, localId: number): ProviderRunResult {
  return {
    ...serverToRunResultSummary(record, localId),
    payload: validateRunResultsExport(record.payload)
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
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: record.createdAt,
    color: readTeamHubColor(record.color)
  };
}

/**
 * Maps a server document record to the local {@link CollectionDocument} shape.
 *
 * @param record - Document payload from HarborClient Server.
 * @param localId - Numeric id assigned by {@link TeamHubIdMap}.
 * @param localCollectionId - Mapped parent collection id.
 * @param localFolderId - Mapped parent folder id, or null at collection root.
 */
function serverToDocument(
  record: DocumentRecord,
  localId: number,
  localCollectionId: number,
  localFolderId: number | null
): CollectionDocument {
  return {
    id: localId,
    uuid: record.id,
    collection_id: localCollectionId,
    folder_id: localFolderId,
    name: record.name,
    content: record.content,
    sort_order: record.sortOrder,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    color: readTeamHubColor(record.color)
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
  const extended = record as SavedRequestRecord & {
    preRequestScripts?: string;
    postRequestScripts?: string;
    pre_request_scripts?: string;
    post_request_scripts?: string;
    tags?: string;
  };
  const preRequestScript = record.preRequestScript;
  const postRequestScript = record.postRequestScript;
  const pre_request_scripts = resolveTeamHubScriptRefs(
    preRequestScript,
    extended.pre_request_scripts ?? extended.preRequestScripts
  );
  const post_request_scripts = resolveTeamHubScriptRefs(
    postRequestScript,
    extended.post_request_scripts ?? extended.postRequestScripts
  );
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
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    pre_request_scripts,
    post_request_scripts,
    comment: record.comment,
    tags: extended.tags ?? '',
    folder_id: localFolderId,
    sort_order: record.sortOrder,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    color: readTeamHubColor(record.color)
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
  auth: TeamHubAuthConfig;
  body: string;
  bodyType: SaveRequestInput['body_type'];
  preRequestScript: string;
  postRequestScript: string;
  pre_request_scripts: string;
  post_request_scripts: string;
  comment: string;
  tags: string;
  folderId: string | null;
  color?: string | null;
} {
  const preResolved = resolveScriptRefs(input.pre_request_scripts, input.pre_request_script ?? '');
  const postResolved = resolveScriptRefs(
    input.post_request_scripts,
    input.post_request_script ?? ''
  );
  const preRequestScript = teamHubScriptColumn(preResolved);
  const postRequestScript = teamHubScriptColumn(postResolved);
  const preScripts = bundleScriptFieldsWithLegacy(preResolved, preRequestScript);
  const postScripts = bundleScriptFieldsWithLegacy(postResolved, postRequestScript);
  const result: {
    name: string;
    method: SaveRequestInput['method'];
    url: string;
    headers: KeyValue[];
    params: KeyValue[];
    auth: TeamHubAuthConfig;
    body: string;
    bodyType: SaveRequestInput['body_type'];
    preRequestScript: string;
    postRequestScript: string;
    pre_request_scripts: string;
    post_request_scripts: string;
    comment: string;
    tags: string;
    folderId: string | null;
    color?: string | null;
  } = {
    name: trimRequiredName(input.name, 'Request name'),
    method: input.method,
    url: input.url,
    headers: input.headers,
    params: input.params,
    auth: toTeamHubAuth(input.auth),
    body: input.body,
    bodyType: input.body_type,
    preRequestScript,
    postRequestScript,
    pre_request_scripts: preScripts.json,
    post_request_scripts: postScripts.json,
    comment: input.comment ?? '',
    tags: input.tags ?? '',
    folderId: folderServerId
  };
  if (input.color !== undefined) {
    result.color = serializeSidebarColor(input.color);
  }
  return result;
}

/**
 * {@link IStorage} adapter backed by HarborClient Server for a single team hub.
 */
export class TeamHubStorage implements IStorage {
  /**
   * @param client - Typed HTTP client for the hub's HarborClient Server instance.
   * @param idMap - Persistent UUID to numeric id map for this hub.
   * @param folderSettings - Local overlay for folder variables, headers, auth, and scripts.
   */
  constructor(
    private readonly client: TeamHubClient,
    private readonly idMap: TeamHubIdMap,
    private readonly folderSettings: TeamHubFolderSettings
  ) {}

  /**
   * Verifies connectivity to HarborClient Server before the router mounts this backend.
   */
  async init(): Promise<void> {
    await this.client.checkHealth();
  }

  /**
   * Returns whether the hub token has management API access (admin stage).
   */
  async hasManagementApi(): Promise<boolean> {
    const session = await this.client.getSession();
    return session.capabilities.managementApi;
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
   * Returns the server UUID for a mapped local snippet id.
   *
   * @param localSnippetId - Provider-local snippet id from the id map.
   */
  getServerSnippetId(localSnippetId: number): string | undefined {
    return this.idMap.toServerId('snippet', localSnippetId);
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
   * Drops the id map entry for a local snippet without calling the server.
   *
   * @param localSnippetId - Provider-local snippet id from the id map.
   */
  forgetLocalSnippet(localSnippetId: number): void {
    const serverId = this.getServerSnippetId(localSnippetId);
    if (serverId) {
      this.idMap.forget('snippet', serverId);
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
    auth: AuthConfig,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Collection> {
    const serverId = this.requireServerId('collection', id);
    const preResolved = resolveScriptRefs(preRequestScripts, preRequestScript);
    const postResolved = resolveScriptRefs(postRequestScripts, postRequestScript);
    const preColumn = teamHubScriptColumn(preResolved);
    const postColumn = teamHubScriptColumn(postResolved);
    const preScripts = bundleScriptFieldsWithLegacy(preResolved, preColumn);
    const postScripts = bundleScriptFieldsWithLegacy(postResolved, postColumn);
    const record = await this.client.updateCollection(serverId, {
      name: trimRequiredName(name, 'Collection name'),
      variables,
      headers,
      preRequestScript: preColumn,
      postRequestScript: postColumn,
      auth: toTeamHubAuth(auth),
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json
    } as Parameters<TeamHubClient['updateCollection']>[1]);
    return serverToCollection(record, id);
  }

  /**
   * Updates a collection's sidebar color.
   *
   * @param id - Collection ID to update.
   * @param color - CSS color string, or null to clear.
   * @returns The updated collection.
   */
  async setCollectionColor(id: number, color: string | null): Promise<Collection> {
    const serverId = this.requireServerId('collection', id);
    return this.patchCollectionColor(serverId, id, color);
  }

  /**
   * Persists only the collection color field on the Team Hub server.
   *
   * @param serverId - Team Hub collection id.
   * @param localId - Provider-local collection id.
   * @param color - CSS color string, or null to clear.
   * @param existing - Collection row to reuse for the full update body when already loaded.
   */
  private async patchCollectionColor(
    serverId: string,
    localId: number,
    color: string | null | undefined,
    existing?: Collection
  ): Promise<Collection> {
    const collection =
      existing ?? (await this.listCollections()).find((entry) => entry.id === localId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    const record = await this.client.updateCollection(serverId, {
      name: collection.name,
      variables: collection.variables,
      headers: collection.headers,
      auth: toTeamHubAuth(collection.auth),
      preRequestScript: collection.pre_request_script,
      postRequestScript: collection.post_request_script,
      color: serializeSidebarColor(color)
    });
    return serverToCollection(record, localId);
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
   * Lists all environments from the server with ids translated to numeric form.
   */
  async listEnvironments(): Promise<Environment[]> {
    const records = await this.client.listEnvironments();
    return records.map((record) =>
      serverToEnvironment(record, this.idMap.toLocalId('environment', record.id))
    );
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
  async setEnvironmentColor(id: number, color: string | null): Promise<Environment> {
    void id;
    void color;
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
   * Lists all snippets from the server with ids translated to numeric form.
   */
  async listSnippets(): Promise<Snippet[]> {
    const records = await this.client.listSnippets();
    return records.map((record) =>
      serverToSnippet(record, this.idMap.toLocalId('snippet', record.id))
    );
  }

  /**
   * Creates a snippet on the server and registers its UUID in the id map.
   */
  async createSnippet(
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE,
    uuid?: string
  ): Promise<Snippet> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const normalizedRole = normalizeScriptStage(stage);
    const record = await this.client.createSnippet({
      name: trimmedName,
      code: code ?? '',
      scope,
      stage: normalizedRole
    } as Parameters<TeamHubClient['createSnippet']>[0]);
    const localId = this.idMap.toLocalId('snippet', record.id);
    void uuid;
    return serverToSnippet(record, localId);
  }

  /**
   * Updates snippet metadata on the server.
   */
  async updateSnippet(
    id: number,
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE
  ): Promise<Snippet> {
    const serverId = this.requireServerId('snippet', id);
    const normalizedRole = normalizeScriptStage(stage);
    const record = await this.client.updateSnippet(serverId, {
      name: trimRequiredName(name, 'Snippet name'),
      code: code ?? '',
      scope,
      stage: normalizedRole
    } as Parameters<TeamHubClient['updateSnippet']>[1]);
    return serverToSnippet(record, id);
  }

  /**
   * Deletes a snippet on the server and forgets its id map entry.
   */
  async deleteSnippet(id: number): Promise<void> {
    const serverId = this.requireServerId('snippet', id);
    await this.client.deleteSnippet(serverId);
    this.idMap.forget('snippet', serverId);
  }

  /**
   * Lists run result snapshots from the server with ids translated to numeric form.
   */
  async listRunResults(): Promise<ProviderRunResultSummary[]> {
    const records = await asTeamHubRunResultClient(this.client).listRunResults();
    return records.map((record) =>
      serverToRunResultSummary(record, this.idMap.toLocalId('run_result', record.id))
    );
  }

  /**
   * Saves a run result snapshot on the server and registers its UUID in the id map.
   */
  async saveRunResult(input: SaveRunResultInput): Promise<ProviderRunResult> {
    const parsed = saveRunResultInputSchema.parse(input);
    const payload = validateRunResultsExport(parsed.payload);
    const record = await asTeamHubRunResultClient(this.client).createRunResult({
      ...(parsed.label ? { label: parsed.label } : {}),
      payload: payload as unknown as Record<string, unknown>
    });
    const localId = this.idMap.toLocalId('run_result', record.id);
    return serverToRunResult(record, localId);
  }

  /**
   * Loads a run result snapshot by provider-local id.
   */
  async getRunResult(id: number): Promise<ProviderRunResult | null> {
    const serverId = this.idMap.toServerId('run_result', id);
    if (!serverId) {
      return null;
    }

    try {
      const record = await asTeamHubRunResultClient(this.client).getRunResult(serverId);
      return serverToRunResult(record, id);
    } catch (err) {
      if (err instanceof TeamHubClientError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Loads a run result snapshot by server UUID without requiring a prior id map entry.
   *
   * @param uuid - Stable run result UUID from a deep link or export file.
   * @returns Provider-local snapshot when found on this hub, otherwise null.
   */
  async fetchRunResultByUuid(uuid: string): Promise<ProviderRunResult | null> {
    const trimmedUuid = uuid.trim();
    if (!trimmedUuid) {
      return null;
    }

    try {
      const record = await asTeamHubRunResultClient(this.client).getRunResult(trimmedUuid);
      const localId = this.idMap.toLocalId('run_result', record.id);
      return serverToRunResult(record, localId);
    } catch (err) {
      if (err instanceof TeamHubClientError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Deletes a run result snapshot on the server and forgets its id map entry.
   */
  async deleteRunResult(id: number): Promise<void> {
    const serverId = this.requireServerId('run_result', id);
    await asTeamHubRunResultClient(this.client).deleteRunResult(serverId);
    this.idMap.forget('run_result', serverId);
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
      } as Parameters<TeamHubClient['updateRequest']>[1]);
      return this.mapRequestRecord(record, input.collection_id);
    }

    const record = await this.client.createRequest(
      collectionServerId,
      body as Parameters<TeamHubClient['createRequest']>[1]
    );
    return this.mapRequestRecord(record, input.collection_id);
  }

  /**
   * Updates a saved request's sidebar color.
   *
   * @param id - Request ID to update.
   * @param color - CSS color string, or null to clear.
   * @returns The updated request.
   */
  async setRequestColor(id: number, color: string | null): Promise<SavedRequest> {
    const { collectionId } = await this.findRequestContainer(id);
    const requests = await this.listRequests(collectionId);
    const existing = requests.find((request) => request.id === id);
    if (!existing) {
      throw new Error('Request not found');
    }

    return this.saveRequest({
      id: existing.id,
      collection_id: existing.collection_id,
      folder_id: existing.folder_id,
      uuid: existing.uuid,
      name: existing.name,
      method: existing.method,
      url: existing.url,
      headers: existing.headers,
      params: existing.params,
      auth: existing.auth,
      body: existing.body,
      body_type: existing.body_type,
      pre_request_script: existing.pre_request_script,
      post_request_script: existing.post_request_script,
      pre_request_scripts: existing.pre_request_scripts,
      post_request_scripts: existing.post_request_scripts,
      comment: existing.comment,
      tags: existing.tags,
      color: serializeSidebarColor(color)
    });
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
   * Lists markdown documents in a collection with ids translated to numeric form.
   *
   * @param collectionId - Provider-local collection id.
   */
  async listDocuments(collectionId: number): Promise<CollectionDocument[]> {
    const collectionServerId = this.requireServerId('collection', collectionId);
    const records = await this.client.listDocuments(collectionServerId);
    return records.map((record) => this.mapDocumentRecord(record, collectionId));
  }

  /**
   * Creates or updates a markdown document on the server.
   *
   * @param input - Document fields with provider-local numeric ids.
   */
  async saveDocument(input: SaveDocumentInput): Promise<CollectionDocument> {
    const collectionServerId = this.requireServerId('collection', input.collection_id);
    const folderServerId =
      input.folder_id != null ? this.requireServerId('folder', input.folder_id) : null;
    const content = input.content ?? '';
    const name = trimRequiredName(input.name, 'Document name');

    if (input.id != null) {
      const documentServerId = this.requireServerId('document', input.id);
      const body: Parameters<TeamHubClient['updateDocument']>[1] = {
        collectionId: collectionServerId,
        name,
        content,
        folderId: folderServerId
      };
      if (input.color !== undefined) {
        body.color = serializeSidebarColor(input.color);
      }
      const record = await this.client.updateDocument(documentServerId, body);
      return this.mapDocumentRecord(record, input.collection_id);
    }

    const body: Parameters<TeamHubClient['createDocument']>[1] = {
      name,
      content,
      folderId: folderServerId
    };
    if (input.color !== undefined) {
      body.color = serializeSidebarColor(input.color);
    }
    const record = await this.client.createDocument(collectionServerId, body);
    return this.mapDocumentRecord(record, input.collection_id);
  }

  /**
   * Updates a markdown document's sidebar color.
   *
   * @param id - Document ID to update.
   * @param color - CSS color string, or null to clear.
   * @returns The updated document.
   */
  async setDocumentColor(id: number, color: string | null): Promise<CollectionDocument> {
    const { collectionId } = await this.findDocumentContainer(id);
    const documents = await this.listDocuments(collectionId);
    const existing = documents.find((document) => document.id === id);
    if (!existing) {
      throw new Error('Document not found');
    }

    return this.saveDocument({
      id: existing.id,
      collection_id: existing.collection_id,
      folder_id: existing.folder_id,
      uuid: existing.uuid,
      name: existing.name,
      content: existing.content,
      color: serializeSidebarColor(color)
    });
  }

  /**
   * Deletes a markdown document on the server.
   *
   * @param id - Provider-local document id.
   */
  async deleteDocument(id: number): Promise<void> {
    const serverId = this.requireServerId('document', id);
    await this.client.deleteDocument(serverId);
    this.idMap.forget('document', serverId);
  }

  /**
   * Reorders documents within a folder or at collection root on the server.
   */
  async reorderDocuments(
    collectionId: number,
    folderId: number | null,
    orderedDocumentIds: number[]
  ): Promise<void> {
    const collectionServerId = this.requireServerId('collection', collectionId);
    const folderServerId = folderId != null ? this.requireServerId('folder', folderId) : null;
    const orderedServerIds = orderedDocumentIds.map((documentId) =>
      this.requireServerId('document', documentId)
    );
    await this.client.reorderDocuments(collectionServerId, {
      folderId: folderServerId,
      orderedDocumentIds: orderedServerIds
    });
  }

  /**
   * Reorders requests and markdown documents together within a folder or collection root on the server.
   *
   * @param collectionId - Provider-local collection id.
   * @param folderId - Provider-local folder id, or null for collection root.
   * @param items - Request and document refs in desired unified sidebar order.
   */
  async reorderContainerItems(
    collectionId: number,
    folderId: number | null,
    items: ContainerItemRef[]
  ): Promise<void> {
    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    assertContainerItemOrder(collectionId, folderId, items, requests, documents);

    if (folderId != null) {
      const folders = await this.listFolders(collectionId);
      if (!folders.some((folder) => folder.id === folderId)) {
        throw new Error('Folder not found');
      }
    }

    const folderServerId = folderId != null ? this.requireServerId('folder', folderId) : null;

    for (let unifiedIndex = 0; unifiedIndex < items.length; unifiedIndex++) {
      const item = items[unifiedIndex];
      if (item.kind === 'request') {
        const requestServerId = this.requireServerId('request', item.id);
        await this.client.moveRequest(requestServerId, {
          folderId: folderServerId,
          index: unifiedIndex
        });
        continue;
      }

      const documentServerId = this.requireServerId('document', item.id);
      await this.client.moveDocument(documentServerId, {
        folderId: folderServerId,
        index: unifiedIndex
      });
    }
  }

  /**
   * Moves a document to another folder or collection root at a given index on the server.
   */
  async moveDocument(documentId: number, folderId: number | null, index: number): Promise<void> {
    const { collectionId, sourceFolderId } = await this.findDocumentContainer(documentId);

    if (folderId != null) {
      const folders = await this.listFolders(collectionId);
      if (!folders.some((folder) => folder.id === folderId)) {
        throw new Error('Folder not found');
      }
    }

    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
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
  }

  /**
   * Merges locally stored folder settings into a server-backed folder row.
   *
   * @param folder - Folder mapped from the server API.
   * @param serverId - Folder UUID from HarborClient Server.
   */
  private mergeFolderSettings(folder: Folder, serverId: string): Folder {
    const stored = this.folderSettings.get(serverId);
    if (!stored) {
      return folder;
    }
    return {
      ...folder,
      variables: stored.variables,
      headers: stored.headers,
      auth: stored.auth,
      pre_request_script: stored.pre_request_script,
      post_request_script: stored.post_request_script,
      pre_request_scripts: stored.pre_request_scripts,
      post_request_scripts: stored.post_request_scripts
    };
  }

  /**
   * Persists folder settings from an import payload into the local overlay.
   *
   * @param localFolderId - Provider-local folder id after create or upsert.
   * @param folder - Exported folder row from the import payload.
   */
  private async applyImportedFolderSettings(
    localFolderId: number,
    folder: ExportedFolder
  ): Promise<void> {
    const settings = resolveImportedFolderSettings(folder);
    await this.updateFolder(
      localFolderId,
      folder.name,
      settings.variables,
      settings.headers,
      settings.preRequestScript,
      settings.postRequestScript,
      settings.auth,
      settings.preRequestScripts,
      settings.postRequestScripts
    );
    if (folder.color !== undefined) {
      const serverId = this.requireServerId('folder', localFolderId);
      await this.client.renameFolder(serverId, {
        name: folder.name,
        color: serializeSidebarColor(folder.color)
      });
    }
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
      this.mergeFolderSettings(
        serverToFolder(record, this.idMap.toLocalId('folder', record.id), collectionId),
        record.id
      )
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
   * Updates a folder name on the server and persists other settings in the local overlay.
   *
   * @param id - Provider-local folder id.
   * @param name - New display name.
   * @param variables - Folder-scoped variables (stored locally).
   * @param headers - Folder headers (stored locally).
   * @param preRequestScript - Folder pre-request script (stored locally).
   * @param postRequestScript - Folder post-request script (stored locally).
   * @param auth - Folder auth (stored locally).
   * @returns The updated folder with locally stored settings merged.
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
    const serverId = this.requireServerId('folder', id);
    this.folderSettings.put(serverId, {
      variables,
      headers,
      auth,
      preRequestScript,
      postRequestScript,
      preRequestScripts,
      postRequestScripts
    });
    const renamed = await this.renameFolder(id, name);
    return this.mergeFolderSettings(renamed, serverId);
  }

  /**
   * Updates a folder's sidebar color on the Team Hub server.
   *
   * @param id - Folder ID to update.
   * @param color - CSS color string, or null to clear.
   * @returns The updated folder.
   */
  async setFolderColor(id: number, color: string | null): Promise<Folder> {
    const serverId = this.requireServerId('folder', id);
    const { collectionId } = await this.findFolderContainer(id);
    const folders = await this.listFolders(collectionId);
    const existing = folders.find((entry) => entry.id === id);
    if (!existing) {
      throw new Error('Folder not found');
    }

    const record = await this.client.renameFolder(serverId, {
      name: existing.name,
      color: serializeSidebarColor(color)
    });
    const localCollectionId = this.idMap.toLocalId('collection', record.collectionId);
    return this.mergeFolderSettings(serverToFolder(record, id, localCollectionId), serverId);
  }

  /**
   * Deletes a folder on the server.
   *
   * @param id - Provider-local folder id.
   */
  async deleteFolder(id: number): Promise<void> {
    const serverId = this.requireServerId('folder', id);
    await this.client.deleteFolder(serverId);
    this.folderSettings.delete(serverId);
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
    const { collectionId, sourceFolderId } = await this.findRequestContainer(requestId);

    if (folderId != null) {
      const folders = await this.listFolders(collectionId);
      if (!folders.some((folder) => folder.id === folderId)) {
        throw new Error('Folder not found');
      }
    }

    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
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
    const folders = folderRows.map(exportedFolderFromFolder);
    const folderNameById = new Map(folderRows.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRows.map((folder) => [folder.id, folder.uuid]));

    const requests = (await this.listRequests(id)).map((request) =>
      savedRequestToExportedRequest(
        request,
        request.folder_id != null ? (folderNameById.get(request.folder_id) ?? null) : null,
        request.folder_id != null ? (folderUuidById.get(request.folder_id) ?? null) : null
      )
    );

    const documents = (await this.listDocuments(id)).map((document) =>
      savedDocumentToExportedDocument(
        document,
        document.folder_id != null ? (folderNameById.get(document.folder_id) ?? null) : null,
        document.folder_id != null ? (folderUuidById.get(document.folder_id) ?? null) : null
      )
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
      pre_request_scripts: collection.pre_request_scripts,
      post_request_scripts: collection.post_request_scripts,
      color: collection.color ?? null,
      folders,
      requests,
      documents
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
      exportData.auth ?? defaultAuth(),
      resolveScriptRefs(exportData.pre_request_scripts, exportData.pre_request_script),
      resolveScriptRefs(exportData.post_request_scripts, exportData.post_request_script)
    );
    await this.patchCollectionColor(
      this.requireServerId('collection', updated.id),
      updated.id,
      exportData.color,
      updated
    );

    const folderMaps: ReturnType<typeof buildFolderImportMaps> = {
      folderIdByUuid: new Map(),
      folderIdByName: new Map(),
      folderUuidById: new Map()
    };
    const orderedFolderIds: number[] = [];

    for (const folder of exportData.folders ?? []) {
      const createdFolder = await this.createFolder(updated.id, folder.name);
      await this.applyImportedFolderSettings(createdFolder.id, folder);
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
      const scripts = importedRequestScriptFields(request);
      const fields = serializeImportedRequestFields(request);
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
        pre_request_script: scripts.pre_request_script,
        post_request_script: scripts.post_request_script,
        pre_request_scripts: scripts.pre_request_scripts,
        post_request_scripts: scripts.post_request_scripts,
        comment: request.comment,
        tags: normalizeRequestTags(request.tags),
        color: fields.color
      });
    }

    for (const document of exportData.documents ?? []) {
      const folderId = resolveImportFolderId(
        document.folder_uuid,
        document.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedDocumentFields(document);
      await this.saveDocument({
        collection_id: updated.id,
        folder_id: folderId,
        uuid: fields.uuid,
        name: fields.name,
        content: fields.content,
        color: fields.color
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
      exportData.auth ?? defaultAuth(),
      resolveScriptRefs(exportData.pre_request_scripts, exportData.pre_request_script),
      resolveScriptRefs(exportData.post_request_scripts, exportData.post_request_script)
    );
    await this.patchCollectionColor(
      this.requireServerId('collection', updated.id),
      updated.id,
      exportData.color,
      updated
    );

    const existingFolders = await this.listFolders(id);
    const folderMaps = buildFolderImportMaps(existingFolders);
    const orderedFolderIds: number[] = [];

    for (const folder of exportData.folders ?? []) {
      const plan = planImportedFolderUpsert(folder, folderMaps);
      if (plan.action === 'update') {
        await this.applyImportedFolderSettings(plan.existingId, folder);
        registerImportedFolderInMaps(folderMaps, plan.existingId, plan.name, plan.uuid);
        orderedFolderIds.push(plan.existingId);
        continue;
      }

      const createdFolder = await this.createFolder(id, plan.name);
      await this.applyImportedFolderSettings(createdFolder.id, folder);
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

      const scripts = importedRequestScriptFields(request);
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
        pre_request_script: scripts.pre_request_script,
        post_request_script: scripts.post_request_script,
        pre_request_scripts: scripts.pre_request_scripts,
        post_request_scripts: scripts.post_request_scripts,
        comment: fields.comment,
        tags: fields.tags,
        color: fields.color
      });
    }

    const existingDocuments = await this.listDocuments(id);
    const documentUuidIndex = buildDocumentUuidIndex(existingDocuments);

    for (const document of exportData.documents ?? []) {
      const folderId = resolveImportFolderId(
        document.folder_uuid,
        document.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedDocumentFields(document);
      const existingDocumentId = fields.uuid ? documentUuidIndex.get(fields.uuid) : undefined;

      await this.saveDocument({
        ...(existingDocumentId != null ? { id: existingDocumentId } : {}),
        collection_id: id,
        folder_id: folderId,
        uuid: fields.uuid,
        name: fields.name,
        content: fields.content,
        color: fields.color
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
   * Maps a server document record using the id map for numeric ids.
   *
   * @param record - Document payload from HarborClient Server.
   * @param localCollectionId - Provider-local parent collection id.
   */
  private mapDocumentRecord(record: DocumentRecord, localCollectionId: number): CollectionDocument {
    const localFolderId =
      record.folderId != null ? this.idMap.toLocalId('folder', record.folderId) : null;
    return serverToDocument(
      record,
      this.idMap.toLocalId('document', record.id),
      localCollectionId,
      localFolderId
    );
  }

  /**
   * Resolves the parent collection for a provider-local folder id.
   *
   * @param folderId - Provider-local folder id.
   */
  private async findFolderContainer(folderId: number): Promise<{ collectionId: number }> {
    const collections = await this.listCollections();
    for (const collection of collections) {
      const folders = await this.listFolders(collection.id);
      if (folders.some((folder) => folder.id === folderId)) {
        return { collectionId: collection.id };
      }
    }
    throw new Error('Folder not found');
  }

  /**
   * Resolves the collection and source folder for a provider-local request id.
   *
   * @param requestId - Provider-local request id.
   */
  private async findRequestContainer(
    requestId: number
  ): Promise<{ collectionId: number; sourceFolderId: number | null }> {
    const collections = await this.listCollections();
    for (const collection of collections) {
      const requests = await this.listRequests(collection.id);
      const request = requests.find((item) => item.id === requestId);
      if (request) {
        return {
          collectionId: collection.id,
          sourceFolderId: request.folder_id ?? null
        };
      }
    }
    throw new Error('Request not found');
  }

  /**
   * Resolves the collection and source folder for a provider-local document id.
   *
   * @param documentId - Provider-local document id.
   */
  private async findDocumentContainer(
    documentId: number
  ): Promise<{ collectionId: number; sourceFolderId: number | null }> {
    const collections = await this.listCollections();
    for (const collection of collections) {
      const documents = await this.listDocuments(collection.id);
      const document = documents.find((item) => item.id === documentId);
      if (document) {
        return {
          collectionId: collection.id,
          sourceFolderId: document.folder_id ?? null
        };
      }
    }
    throw new Error('Document not found');
  }

  /**
   * Resolves a provider-local id to a server UUID or throws when unknown.
   *
   * @param entityType - Entity kind to resolve.
   * @param localId - Provider-local numeric id.
   */
  private requireServerId(
    entityType: 'collection' | 'document' | 'folder' | 'request' | 'run_result' | 'snippet',
    localId: number
  ): string {
    const serverId = this.idMap.toServerId(entityType, localId);
    if (!serverId) {
      throw new Error(`${entityType} not found: ${localId}`);
    }
    return serverId;
  }
}
