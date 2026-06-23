import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { maskVariablesForExport, validateCollectionExport } from '#/main/db/collectionData';
import { validateEnvironmentExport } from '#/main/db/collectionData';
import { validateRequestExport } from '#/main/db/collectionData';
import { generateDocumentUuid, resolveImportUuid } from '#/main/db/uuid';
import { uuidSlugPrefix } from '#/main/git/slug';
import type {
  CollectionExport,
  EnvironmentExport,
  ExportedFolder,
  ExportedRequest,
  RequestExport
} from '#/shared/types';
import { parseJson } from '#/shared/parseJson';

/**
 * Reads and parses a JSON file, throwing a descriptive error when parsing fails.
 *
 * @param filePath - Absolute path to the JSON file.
 * @returns Parsed JSON value.
 * @throws When the file cannot be read or contains invalid JSON.
 */
function readJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON in ${filePath}: ${detail}`);
  }
}

/**
 * Folder row stored in collection.json with a stable uuid.
 */
export interface StoredFolderRow {
  /**
   * Stable folder identifier.
   */
  uuid: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Position among sibling folders.
   */
  sort_order: number;
}

/**
 * Collection manifest stored as collection.json (requests live in requests/).
 */
export interface CollectionManifest {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Discriminator for collection exports.
   */
  harborclientExport: 'collection';

  /**
   * Stable collection uuid.
   */
  uuid: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Collection variables.
   */
  variables: CollectionExport['variables'];

  /**
   * Collection headers.
   */
  headers: CollectionExport['headers'];

  /**
   * Default authorization.
   */
  auth?: CollectionExport['auth'];

  /**
   * Collection pre-request script.
   */
  pre_request_script: string;

  /**
   * Collection post-request script.
   */
  post_request_script: string;

  /**
   * Folders with stable uuids.
   */
  folders: StoredFolderRow[];

  /**
   * ISO 8601 creation timestamp.
   */
  created_at: string;
}

/**
 * Default .gitignore content generated when linking a repository.
 */
export const DEFAULT_HARBORCLIENT_GITIGNORE = [
  '# Local environment overrides (do not commit secrets)',
  'environments/local*.json',
  'environments/*-local.json'
].join('\n');

/**
 * Resolves the HarborClient root directory inside a repository.
 *
 * @param repoPath - Repository root path.
 * @param subdir - Configured subdirectory (for example `.harborclient`).
 * @returns Absolute path to the HarborClient data root.
 */
export function resolveHarborclientRoot(repoPath: string, subdir: string): string {
  const trimmed = subdir.trim() || '.harborclient';
  return join(repoPath, trimmed);
}

/**
 * Returns the collections directory path under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function collectionsDir(root: string): string {
  return join(root, 'collections');
}

/**
 * Returns the environments directory path under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function environmentsDir(root: string): string {
  return join(root, 'environments');
}

/**
 * Ensures the HarborClient directory layout exists and writes a default .gitignore.
 *
 * @param root - HarborClient data root.
 */
export function ensureHarborclientLayout(root: string): void {
  mkdirSync(collectionsDir(root), { recursive: true });
  mkdirSync(environmentsDir(root), { recursive: true });
  const gitignorePath = join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${DEFAULT_HARBORCLIENT_GITIGNORE}\n`, 'utf-8');
  }
}

/**
 * Parses a collection directory name into uuid and optional slug suffix.
 *
 * @param dirName - Directory name `uuid-slug`.
 * @returns Collection uuid or null when the prefix is not a valid uuid segment.
 */
export function parseCollectionDirName(dirName: string): string | null {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(dirName);
  return match?.[1] ?? null;
}

/**
 * Parses a request file name into uuid.
 *
 * @param fileName - File name `uuid-slug.json`.
 */
export function parseRequestFileName(fileName: string): string | null {
  if (!fileName.endsWith('.json')) {
    return null;
  }
  const base = fileName.slice(0, -5);
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(base);
  return match?.[1] ?? null;
}

/**
 * Parses an environment file name into uuid.
 *
 * @param fileName - File name `uuid-slug.json`.
 */
export function parseEnvironmentFileName(fileName: string): string | null {
  return parseRequestFileName(fileName);
}

/**
 * Returns the collection directory path for a collection uuid and name.
 *
 * @param root - HarborClient data root.
 * @param uuid - Collection uuid.
 * @param name - Collection display name.
 */
export function collectionDir(root: string, uuid: string, name: string): string {
  return join(collectionsDir(root), uuidSlugPrefix(uuid, name));
}

/**
 * Reads collection manifest and request files from a collection directory.
 *
 * @param dir - Absolute path to the collection directory.
 * @returns Manifest and parsed request exports.
 */
export function readCollectionFromDir(dir: string): {
  manifest: CollectionManifest;
  requests: ExportedRequest[];
} {
  const manifestPath = join(dir, 'collection.json');
  const raw = readJsonFile(manifestPath) as Record<string, unknown>;
  const manifest: CollectionManifest = {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: String(raw.uuid ?? ''),
    name: String(raw.name ?? ''),
    variables: (raw.variables as CollectionManifest['variables']) ?? [],
    headers: (raw.headers as CollectionManifest['headers']) ?? [],
    auth: raw.auth as CollectionManifest['auth'],
    pre_request_script: String(raw.pre_request_script ?? ''),
    post_request_script: String(raw.post_request_script ?? ''),
    folders: ((raw.folders as StoredFolderRow[]) ?? []).map((folder, index) => ({
      uuid: resolveImportUuid(folder.uuid),
      name: String(folder.name ?? '').trim(),
      sort_order: folder.sort_order ?? index
    })),
    created_at: String(raw.created_at ?? new Date().toISOString())
  };

  const requestsDir = join(dir, 'requests');
  const requests: ExportedRequest[] = [];
  if (existsSync(requestsDir)) {
    for (const fileName of readdirSync(requestsDir)) {
      if (!fileName.endsWith('.json')) {
        continue;
      }
      const requestPath = join(requestsDir, fileName);
      const parsed = readJsonFile(requestPath);
      const validated = validateRequestExport(parsed);
      requests.push({
        ...validated,
        uuid: validated.uuid,
        sort_order:
          typeof (parsed as { sort_order?: number }).sort_order === 'number'
            ? (parsed as { sort_order: number }).sort_order
            : requests.length,
        folder_name:
          typeof (parsed as { folder_name?: string | null }).folder_name === 'string'
            ? (parsed as { folder_name: string }).folder_name
            : null,
        folder_uuid:
          typeof (parsed as { folder_uuid?: string }).folder_uuid === 'string'
            ? (parsed as { folder_uuid: string }).folder_uuid
            : undefined
      });
    }
  }

  return { manifest, requests };
}

/**
 * Writes a collection manifest and request files to disk.
 *
 * @param dir - Collection directory path.
 * @param manifest - Collection manifest to write.
 * @param requests - Request rows to write as individual files.
 */
export function writeCollectionToDir(
  dir: string,
  manifest: CollectionManifest,
  requests: ExportedRequest[]
): void {
  mkdirSync(dir, { recursive: true });
  const requestsPath = join(dir, 'requests');
  mkdirSync(requestsPath, { recursive: true });

  const maskedManifest = {
    ...manifest,
    variables: maskVariablesForExport(manifest.variables)
  };
  writeFileSync(join(dir, 'collection.json'), JSON.stringify(maskedManifest, null, 2), 'utf-8');

  const writtenUuids = new Set<string>();
  for (const request of requests) {
    const uuid = resolveImportUuid(request.uuid);
    writtenUuids.add(uuid);
    const fileName = `${uuidSlugPrefix(uuid, request.name)}.json`;
    const payload = exportedRequestToRequestExport(request);
    writeFileSync(
      join(requestsPath, fileName),
      JSON.stringify(
        {
          ...payload,
          sort_order: request.sort_order,
          folder_name: request.folder_name ?? null,
          folder_uuid: request.folder_uuid ?? null
        },
        null,
        2
      ),
      'utf-8'
    );
  }

  if (existsSync(requestsPath)) {
    for (const fileName of readdirSync(requestsPath)) {
      if (!fileName.endsWith('.json')) {
        continue;
      }
      const uuid = parseRequestFileName(fileName);
      if (uuid && !writtenUuids.has(uuid)) {
        rmSync(join(requestsPath, fileName), { force: true });
      }
    }
  }
}

/**
 * Converts manifest + requests into a validated CollectionExport payload.
 *
 * @param manifest - Stored collection manifest.
 * @param requests - Request export rows.
 */
export function manifestToCollectionExport(
  manifest: CollectionManifest,
  requests: ExportedRequest[]
): CollectionExport {
  const folders: ExportedFolder[] = manifest.folders.map((folder) => ({
    uuid: folder.uuid,
    name: folder.name,
    sort_order: folder.sort_order
  }));

  return validateCollectionExport({
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: manifest.uuid,
    name: manifest.name,
    variables: manifest.variables,
    headers: manifest.headers,
    auth: manifest.auth,
    pre_request_script: manifest.pre_request_script,
    post_request_script: manifest.post_request_script,
    folders,
    requests
  });
}

/**
 * Lists collection uuids discovered under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function listCollectionUuidsOnDisk(root: string): string[] {
  const dir = collectionsDir(root);
  if (!existsSync(dir)) {
    return [];
  }

  const uuids: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const uuid = parseCollectionDirName(entry.name);
    if (uuid && existsSync(join(dir, entry.name, 'collection.json'))) {
      uuids.push(uuid);
    }
  }
  return uuids;
}

/**
 * Finds a collection directory path by uuid under a HarborClient root.
 *
 * @param root - HarborClient data root.
 * @param uuid - Collection uuid to locate.
 */
export function findCollectionDirByUuid(root: string, uuid: string): string | null {
  const dir = collectionsDir(root);
  if (!existsSync(dir)) {
    return null;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const entryUuid = parseCollectionDirName(entry.name);
    if (entryUuid === uuid) {
      return join(dir, entry.name);
    }
  }
  return null;
}

/**
 * Writes an environment export file.
 *
 * @param root - HarborClient data root.
 * @param data - Environment export payload.
 */
export function writeEnvironmentFile(root: string, data: EnvironmentExport): void {
  const dir = environmentsDir(root);
  mkdirSync(dir, { recursive: true });
  const uuid = resolveImportUuid(data.uuid);
  const fileName = `${uuidSlugPrefix(uuid, data.name)}.json`;
  writeFileSync(join(dir, fileName), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Reads all environment export files under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function readAllEnvironments(root: string): EnvironmentExport[] {
  const dir = environmentsDir(root);
  if (!existsSync(dir)) {
    return [];
  }

  const environments: EnvironmentExport[] = [];
  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const envPath = join(dir, fileName);
    const parsed = readJsonFile(envPath);
    environments.push(validateEnvironmentExport(parsed));
  }
  return environments;
}

/**
 * Deletes an environment file by uuid.
 *
 * @param root - HarborClient data root.
 * @param uuid - Environment uuid.
 */
export function deleteEnvironmentFile(root: string, uuid: string): void {
  const dir = environmentsDir(root);
  if (!existsSync(dir)) {
    return;
  }

  for (const fileName of readdirSync(dir)) {
    const fileUuid = parseEnvironmentFileName(fileName);
    if (fileUuid === uuid) {
      rmSync(join(dir, fileName), { force: true });
    }
  }
}

/**
 * Converts a request export row to RequestExport shape for single-file writes.
 *
 * @param request - Exported request row from a collection.
 */
export function exportedRequestToRequestExport(request: ExportedRequest): RequestExport {
  return validateRequestExport({
    harborclientVersion: 1,
    harborclientExport: 'request',
    uuid: request.uuid,
    name: request.name,
    method: request.method,
    url: request.url,
    params: request.params,
    headers: request.headers,
    auth: request.auth,
    body_type: request.body_type,
    body: request.body,
    pre_request_script: request.pre_request_script,
    post_request_script: request.post_request_script,
    comment: request.comment
  });
}

/**
 * Creates a new stored folder row with a fresh uuid.
 *
 * @param name - Folder display name.
 * @param sort_order - Folder position.
 */
export function createStoredFolder(name: string, sort_order: number): StoredFolderRow {
  return {
    uuid: generateDocumentUuid(),
    name: name.trim(),
    sort_order
  };
}

/**
 * Reads provider-local settings JSON from userData for a git connection.
 *
 * @param userDataPath - Electron userData path.
 * @param connectionId - Git connection id.
 */
export function readGitProviderSettings(
  userDataPath: string,
  connectionId: string
): Record<string, string> {
  const path = join(userDataPath, 'git-provider-settings', `${connectionId}.json`);
  if (!existsSync(path)) {
    return {};
  }
  return parseJson<Record<string, string>>(readFileSync(path, 'utf-8'), {});
}

/**
 * Writes provider-local settings JSON to userData for a git connection.
 *
 * @param userDataPath - Electron userData path.
 * @param connectionId - Git connection id.
 * @param settings - Key-value settings map.
 */
export function writeGitProviderSettings(
  userDataPath: string,
  connectionId: string,
  settings: Record<string, string>
): void {
  const dir = join(userDataPath, 'git-provider-settings');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${connectionId}.json`), JSON.stringify(settings, null, 2), 'utf-8');
}
