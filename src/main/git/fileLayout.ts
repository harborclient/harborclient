import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import {
  maskVariablesForExport,
  validateCollectionExport,
  validateEnvironmentExport
} from '#/main/storage/collectionData';
import { validateSnippetExport } from '#/main/storage/snippetData';
import { generateDocumentUuid, resolveImportUuid } from '#/main/storage/uuid';
import { exportFileBaseName } from '#/main/git/slug';
import type {
  CollectionExport,
  EnvironmentExport,
  ExportedDocument,
  ExportedRequest,
  SnippetExport
} from '#/shared/types';
import { parseJson } from '#/shared/parseJson';
import { readScriptRefsFromJson } from '#/shared/scriptRefs';
import type { AuthConfig } from '#/shared/auth';
import { defaultAuth } from '#/shared/auth';
import type { KeyValue, Variable } from '#/shared/types/common';
import type { ScriptRef } from '#/shared/types/script';

/**
 * Reserved top-level entries under a HarborClient data root.
 */
const HARBOR_ROOT_RESERVED_NAMES = new Set(['.gitignore']);

/**
 * HarborClient export discriminators stored as root JSON files.
 */
export type HarborExportKind = 'collection' | 'environment' | 'snippet';

/**
 * Returns the HarborClient export kind from a parsed JSON object, or null when unknown.
 *
 * @param parsed - Parsed JSON value read from disk.
 */
export function parseHarborExportKind(parsed: unknown): HarborExportKind | null {
  if (parsed == null || typeof parsed !== 'object') {
    return null;
  }
  const kind = (parsed as { harborclientExport?: unknown }).harborclientExport;
  if (kind === 'collection' || kind === 'environment' || kind === 'snippet') {
    return kind;
  }
  return null;
}

/**
 * Normalizes a document display name into a harbor-root markdown file name.
 *
 * Preserves entered casing, appends `.md` when omitted, and rejects unsafe names.
 *
 * @param displayName - User-facing document title.
 * @returns Case-preserving markdown file name.
 * @throws When the name is empty or unsafe for the Harbor data root.
 */
export function normalizeDocumentDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error('Document name is required');
  }
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('Document name cannot contain path separators');
  }
  const baseName = basename(trimmed);
  if (!baseName || baseName === '.' || baseName === '..') {
    throw new Error('Document name is invalid');
  }
  if (baseName.toLowerCase().endsWith('.md')) {
    return baseName;
  }
  return `${baseName}.md`;
}

/**
 * Builds the on-disk markdown file name for a document at the Harbor data root.
 *
 * @param displayName - User-facing document title (for example README.md).
 */
export function documentFileName(displayName: string): string {
  return normalizeDocumentDisplayName(displayName);
}

/**
 * Returns the absolute path for one harbor-root markdown document file.
 *
 * @param harborRoot - HarborClient data root.
 * @param displayName - User-facing document title.
 */
export function documentFilePath(harborRoot: string, displayName: string): string {
  const fileName = documentFileName(displayName);
  const resolvedRoot = resolve(harborRoot);
  const resolvedPath = resolve(join(resolvedRoot, fileName));
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}/`)) {
    throw new Error('Document name escapes the HarborClient root');
  }
  return resolvedPath;
}

/**
 * Returns true when a repository-relative path is a harbor-root markdown file.
 *
 * @param filepath - Repository-relative path.
 * @param harborSubdir - HarborClient subdirectory prefix.
 */
export function isHarborDocumentPath(filepath: string, harborSubdir: string): boolean {
  const normalized = filepath.replace(/\\/g, '/');
  const prefix = harborSubdir === '.' ? '' : `${harborSubdir}/`;
  if (harborSubdir !== '.' && !normalized.startsWith(prefix)) {
    return false;
  }

  const relative = harborSubdir === '.' ? normalized : normalized.slice(prefix.length);
  if (!relative.endsWith('.md') || relative.includes('/')) {
    return false;
  }

  const baseName = relative.slice(relative.lastIndexOf('/') + 1);
  return !HARBOR_ROOT_RESERVED_NAMES.has(baseName);
}

/**
 * Metadata for one managed markdown document file at the Harbor data root.
 */
export interface HarborRootDocumentEntry {
  /**
   * Stable document uuid from the owning collection export.
   */
  uuid: string;

  /**
   * Stable collection uuid owning this document.
   */
  collection_uuid: string;

  /**
   * User-facing document title from the collection export.
   */
  name: string;

  /**
   * Absolute path to the markdown file on disk.
   */
  filePath: string;

  /**
   * Base file name at the Harbor data root.
   */
  fileName: string;
}

/**
 * Metadata for one managed HarborClient export JSON file at the harbor root.
 */
export interface HarborExportFileEntry {
  /**
   * Export discriminator stored in the JSON payload.
   */
  kind: HarborExportKind;

  /**
   * Stable resource uuid from the JSON payload.
   */
  uuid: string;

  /**
   * Base file name at the Harbor data root.
   */
  fileName: string;

  /**
   * Absolute path to the export JSON file.
   */
  filePath: string;
}

/**
 * Returns the on-disk JSON file name for a HarborClient export.
 *
 * @param kind - Export discriminator.
 * @param name - Display name used for the slug portion.
 */
export function exportFileName(kind: HarborExportKind, name: string): string {
  return `${exportFileBaseName(kind, name)}.json`;
}

/**
 * Returns true when a harbor export file name matches local-override gitignore globs.
 *
 * @param fileName - Base file name at the Harbor data root.
 */
export function isGitignoredHarborExportFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (lower.startsWith('local') && lower.endsWith('.json')) {
    return true;
  }
  return lower.endsWith('-local.json');
}

/**
 * Returns the absolute path for one HarborClient export JSON file at the data root.
 *
 * @param root - HarborClient data root.
 * @param kind - Export discriminator.
 * @param name - Display name used for the slug portion.
 */
export function exportFilePath(root: string, kind: HarborExportKind, name: string): string {
  return join(root, exportFileName(kind, name));
}

/**
 * Returns the collection export file path for a collection display name.
 *
 * @param root - HarborClient data root.
 * @param name - Collection display name.
 */
export function collectionFilePath(root: string, name: string): string {
  return exportFilePath(root, 'collection', name);
}

/**
 * Returns the environment export file path for an environment display name.
 *
 * @param root - HarborClient data root.
 * @param name - Environment display name.
 */
export function environmentFilePath(root: string, name: string): string {
  return exportFilePath(root, 'environment', name);
}

/**
 * Returns the snippet export file path for a snippet display name.
 *
 * @param root - HarborClient data root.
 * @param name - Snippet display name.
 */
export function snippetFilePath(root: string, name: string): string {
  return exportFilePath(root, 'snippet', name);
}

/**
 * Reads the stable uuid from one HarborClient export JSON file.
 *
 * @param filePath - Absolute path to the export JSON file.
 */
function readExportUuidFromFile(filePath: string): string | null {
  try {
    const parsed = readJsonFile(filePath) as { uuid?: string };
    if (typeof parsed.uuid !== 'string' || !parsed.uuid.trim()) {
      return null;
    }
    return resolveImportUuid(parsed.uuid);
  } catch {
    return null;
  }
}

/**
 * Lists managed HarborClient export JSON files at the harbor root.
 *
 * @param harborRoot - HarborClient data root.
 */
export function listManagedHarborExportFiles(harborRoot: string): HarborExportFileEntry[] {
  if (!existsSync(harborRoot)) {
    return [];
  }

  const entries: HarborExportFileEntry[] = [];
  for (const fileName of readdirSync(harborRoot)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const filePath = join(harborRoot, fileName);
    let parsed: unknown;
    try {
      parsed = readJsonFile(filePath);
    } catch {
      continue;
    }
    const kind = parseHarborExportKind(parsed);
    if (kind == null) {
      continue;
    }
    const uuid = resolveImportUuid(String((parsed as { uuid?: string }).uuid ?? ''));
    if (!uuid) {
      continue;
    }
    entries.push({ kind, uuid, fileName, filePath });
  }

  return entries;
}

/**
 * Ensures an export filename is available at the Harbor data root.
 *
 * @param harborRoot - HarborClient data root.
 * @param kind - Export discriminator for the candidate file.
 * @param name - Candidate display name.
 * @param ownerUuid - Resource uuid allowed to keep the filename.
 * @throws When the filename is gitignored or owned by another export.
 */
export function assertExportFilenameAvailable(
  harborRoot: string,
  kind: HarborExportKind,
  name: string,
  ownerUuid: string
): void {
  const fileName = exportFileName(kind, name);
  if (isGitignoredHarborExportFileName(fileName)) {
    throw new Error(
      `The export name "${name.trim()}" would create "${fileName}", which is ignored by the HarborClient .gitignore. Choose a different name.`
    );
  }

  const normalizedOwnerUuid = resolveImportUuid(ownerUuid);
  const normalizedFileName = fileName.toLowerCase();

  for (const entry of listManagedHarborExportFiles(harborRoot)) {
    if (entry.fileName.toLowerCase() !== normalizedFileName) {
      continue;
    }
    if (entry.uuid !== normalizedOwnerUuid) {
      throw new Error(`An export file named "${fileName}" already exists in this repository.`);
    }
  }
}

/**
 * Removes stale export JSON files for one resource uuid and export kind.
 *
 * @param root - HarborClient data root.
 * @param kind - Export discriminator to match.
 * @param uuid - Stable resource uuid.
 * @param keepPath - Path that should remain on disk.
 */
function removeStaleExportFilesForUuid(
  root: string,
  kind: HarborExportKind,
  uuid: string,
  keepPath: string
): void {
  if (!existsSync(root)) {
    return;
  }

  for (const fileName of readdirSync(root)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const filePath = join(root, fileName);
    if (filePath === keepPath) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = readJsonFile(filePath);
    } catch {
      continue;
    }
    if (parseHarborExportKind(parsed) !== kind) {
      continue;
    }
    const fileUuid = readExportUuidFromFile(filePath);
    if (fileUuid === uuid) {
      rmSync(filePath, { force: true });
    }
  }
}

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
 * Normalizes script reference fields that git storage may persist as JSON strings.
 *
 * @param parsed - Raw export row read from disk.
 */
function normalizeScriptRefFields(parsed: Record<string, unknown>): Record<string, unknown> {
  const preLegacy = String(parsed.pre_request_script ?? '');
  const postLegacy = String(parsed.post_request_script ?? '');
  const normalized: Record<string, unknown> = { ...parsed };

  if (typeof parsed.pre_request_scripts === 'string') {
    normalized.pre_request_scripts = readScriptRefsFromJson(parsed.pre_request_scripts, preLegacy);
  }
  if (typeof parsed.post_request_scripts === 'string') {
    normalized.post_request_scripts = readScriptRefsFromJson(
      parsed.post_request_scripts,
      postLegacy
    );
  }

  return normalized;
}

/**
 * Normalizes a collection export payload before schema validation.
 *
 * @param parsed - Raw collection JSON read from disk.
 */
function normalizeStoredCollectionForValidation(
  parsed: Record<string, unknown>
): Record<string, unknown> {
  const normalized = normalizeScriptRefFields(parsed);
  const folders = Array.isArray(parsed.folders)
    ? parsed.folders
        .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
        .map((folder) => normalizeScriptRefFields(folder))
    : [];
  const requests = Array.isArray(parsed.requests)
    ? parsed.requests
        .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
        .map((request) => normalizeScriptRefFields(request))
    : [];

  return {
    ...normalized,
    folders,
    requests
  };
}

/**
 * Determines whether a newly parsed duplicate request row should replace the
 * one already chosen for the same UUID.
 *
 * @param candidate - Newly parsed duplicate candidate.
 * @param current - Candidate currently selected for the UUID.
 * @returns True when the candidate should replace the current selection.
 */
function isBetterRequestCandidate(
  candidate: { hasUrl: boolean; mtimeMs: number },
  current: { hasUrl: boolean; mtimeMs: number }
): boolean {
  if (candidate.hasUrl !== current.hasUrl) {
    return candidate.hasUrl;
  }
  return candidate.mtimeMs > current.mtimeMs;
}

/**
 * Collapses duplicate request rows that share a UUID to a single export row.
 *
 * @param requests - Request rows loaded from a collection export.
 */
function collapseDuplicateRequests(requests: ExportedRequest[]): ExportedRequest[] {
  const bestByUuid = new Map<string, { row: ExportedRequest; hasUrl: boolean; mtimeMs: number }>();
  const orderedKeys: string[] = [];

  for (const row of requests) {
    const key = resolveImportUuid(row.uuid);
    const candidate = {
      row,
      hasUrl: (row.url ?? '').trim().length > 0,
      mtimeMs: 0
    };
    const current = bestByUuid.get(key);
    if (current == null) {
      bestByUuid.set(key, candidate);
      orderedKeys.push(key);
    } else if (isBetterRequestCandidate(candidate, current)) {
      bestByUuid.set(key, candidate);
    }
  }

  return orderedKeys.map((key) => bestByUuid.get(key)!.row);
}

/**
 * Reads and validates a collection export from one JSON file.
 *
 * @param filePath - Absolute path to the collection export file.
 */
export function readCollectionFile(filePath: string): CollectionExport {
  const parsed = readJsonFile(filePath) as Record<string, unknown>;
  if (parseHarborExportKind(parsed) !== 'collection') {
    throw new Error(`Expected a collection export in ${filePath}`);
  }

  const validated = validateCollectionExport(normalizeStoredCollectionForValidation(parsed));
  return {
    ...validated,
    requests: collapseDuplicateRequests(validated.requests ?? [])
  };
}

/**
 * Writes a validated collection export to a single JSON file at the Harbor data root.
 *
 * Removes stale slug files for the same collection uuid when the display name changes.
 *
 * @param root - HarborClient data root.
 * @param exportData - Collection export payload to persist.
 */
export function writeCollectionFile(root: string, exportData: CollectionExport): void {
  mkdirSync(root, { recursive: true });
  const validated = validateCollectionExport(exportData);
  const uuid = resolveImportUuid(validated.uuid);
  assertExportFilenameAvailable(root, 'collection', validated.name, uuid);
  const targetPath = collectionFilePath(root, validated.name);
  const masked = {
    ...validated,
    uuid,
    variables: maskVariablesForExport(validated.variables),
    folders: (validated.folders ?? []).map((folder) => ({
      ...folder,
      variables: maskVariablesForExport(folder.variables ?? [])
    }))
  };

  writeFileSync(targetPath, JSON.stringify(masked, null, 2), 'utf-8');
  removeStaleExportFilesForUuid(root, 'collection', uuid, targetPath);
}

/**
 * Lists collection uuids discovered as root collection export files.
 *
 * @param root - HarborClient data root.
 */
export function listCollectionUuidsOnDisk(root: string): string[] {
  return listCollectionFilesOnDisk(root).map((entry) => entry.uuid);
}

/**
 * One collection export file discovered at the Harbor data root.
 */
export interface CollectionFileEntry {
  /**
   * Stable collection uuid parsed from the file name.
   */
  uuid: string;

  /**
   * Absolute path to the collection export JSON file.
   */
  filePath: string;
}

/**
 * Lists collection export files at the Harbor data root.
 *
 * @param root - HarborClient data root.
 */
export function listCollectionFilesOnDisk(root: string): CollectionFileEntry[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries: CollectionFileEntry[] = [];
  for (const fileName of readdirSync(root)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const filePath = join(root, fileName);
    const parsed = readJsonFile(filePath);
    if (parseHarborExportKind(parsed) !== 'collection') {
      continue;
    }
    const uuid = resolveImportUuid(String((parsed as { uuid?: string }).uuid ?? ''));
    if (!uuid) {
      continue;
    }
    entries.push({ uuid, filePath });
  }

  return entries;
}

/**
 * Finds a collection export file path by uuid under a HarborClient root.
 *
 * @param root - HarborClient data root.
 * @param uuid - Collection uuid to locate.
 */
export function findCollectionFileByUuid(root: string, uuid: string): string | null {
  const normalizedUuid = resolveImportUuid(uuid).toLowerCase();
  for (const entry of listCollectionFilesOnDisk(root)) {
    if (entry.uuid.toLowerCase() === normalizedUuid) {
      return entry.filePath;
    }
  }
  return null;
}

/**
 * Lists all managed markdown documents at the Harbor data root across collections.
 *
 * @param harborRoot - HarborClient data root.
 */
export function listManagedHarborRootDocuments(harborRoot: string): HarborRootDocumentEntry[] {
  const documents: HarborRootDocumentEntry[] = [];

  for (const entry of listCollectionFilesOnDisk(harborRoot)) {
    const exportData = readCollectionFile(entry.filePath);
    for (const document of exportData.documents ?? []) {
      const uuid = resolveImportUuid(document.uuid);
      if (!uuid || !document.name.trim()) {
        continue;
      }
      const filePath = documentFilePath(harborRoot, document.name);
      documents.push({
        uuid,
        collection_uuid: entry.uuid,
        name: document.name,
        filePath,
        fileName: basename(filePath)
      });
    }
  }

  return documents;
}

/**
 * Builds a case-insensitive filename map for managed harbor-root documents.
 *
 * @param harborRoot - HarborClient data root.
 */
export function buildFilenameToDocumentMap(
  harborRoot: string
): Map<string, HarborRootDocumentEntry> {
  const map = new Map<string, HarborRootDocumentEntry>();
  for (const entry of listManagedHarborRootDocuments(harborRoot)) {
    map.set(entry.fileName.toLowerCase(), entry);
  }
  return map;
}

/**
 * Ensures a document filename is available at the Harbor data root.
 *
 * @param harborRoot - HarborClient data root.
 * @param displayName - Candidate document display name.
 * @param ownerUuid - Document uuid that is allowed to keep the filename.
 * @throws When another managed document already owns the filename.
 */
export function assertDocumentFilenameAvailable(
  harborRoot: string,
  displayName: string,
  ownerUuid: string
): void {
  const fileName = documentFileName(displayName);
  const normalizedOwnerUuid = resolveImportUuid(ownerUuid);
  const normalizedFileName = fileName.toLowerCase();

  for (const entry of listManagedHarborRootDocuments(harborRoot)) {
    if (entry.fileName.toLowerCase() !== normalizedFileName) {
      continue;
    }
    if (entry.uuid !== normalizedOwnerUuid) {
      throw new Error(`A markdown document named "${fileName}" already exists in this repository.`);
    }
  }
}

/**
 * Writes markdown document files at the Harbor data root for one collection.
 *
 * @param harborRoot - HarborClient data root.
 * @param collectionUuid - Stable collection uuid.
 * @param documents - Document export rows to persist.
 */
export function writeDocumentsToHarborRoot(
  harborRoot: string,
  collectionUuid: string,
  documents: ExportedDocument[]
): void {
  mkdirSync(harborRoot, { recursive: true });

  const normalizedCollectionUuid = resolveImportUuid(collectionUuid);
  const writtenUuids = new Set<string>();
  const existingUuidToPath = new Map<string, string>();
  const reservedNames = new Map<string, string>();

  for (const entry of listManagedHarborRootDocuments(harborRoot)) {
    existingUuidToPath.set(entry.uuid, entry.filePath);
    reservedNames.set(entry.fileName.toLowerCase(), entry.uuid);
  }

  for (const document of documents) {
    const uuid = resolveImportUuid(document.uuid);
    const fileName = documentFileName(document.name);
    const normalizedFileName = fileName.toLowerCase();
    const existingOwner = reservedNames.get(normalizedFileName);
    if (existingOwner != null && existingOwner !== uuid) {
      throw new Error(`A markdown document named "${fileName}" already exists in this repository.`);
    }
    reservedNames.set(normalizedFileName, uuid);
  }

  for (const document of documents) {
    const uuid = resolveImportUuid(document.uuid);
    writtenUuids.add(uuid);
    const targetPath = documentFilePath(harborRoot, document.name);
    writeFileSync(targetPath, document.content, 'utf-8');

    const previousPath = existingUuidToPath.get(uuid);
    if (previousPath && previousPath !== targetPath) {
      rmSync(previousPath, { force: true });
    }
  }

  for (const [uuid, filePath] of existingUuidToPath.entries()) {
    if (!writtenUuids.has(uuid)) {
      const entry = listManagedHarborRootDocuments(harborRoot).find((row) => row.uuid === uuid);
      if (entry?.collection_uuid === normalizedCollectionUuid) {
        rmSync(filePath, { force: true });
      }
    }
  }
}

/**
 * Reads markdown document export rows from collection exports and harbor-root files.
 *
 * Prefers inline content from the collection JSON; falls back to the mirrored `.md` file.
 *
 * @param harborRoot - HarborClient data root.
 * @param collectionUuid - Stable collection uuid.
 */
export function readDocumentsFromHarborRoot(
  harborRoot: string,
  collectionUuid: string
): ExportedDocument[] {
  const filePath = findCollectionFileByUuid(harborRoot, collectionUuid);
  if (!filePath) {
    return [];
  }

  const exportData = readCollectionFile(filePath);
  const documents: ExportedDocument[] = [];

  for (const document of exportData.documents ?? []) {
    let content = document.content ?? '';
    if (!content.trim()) {
      const mdPath = documentFilePath(harborRoot, document.name);
      if (existsSync(mdPath)) {
        content = readFileSync(mdPath, 'utf-8');
      }
    }
    documents.push({
      ...document,
      content
    });
  }

  return documents.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * Default .gitignore content generated when linking a repository.
 */
export const DEFAULT_HARBORCLIENT_GITIGNORE = [
  '# Local environment overrides (do not commit secrets)',
  'local*.json',
  '*-local.json'
].join('\n');

/**
 * Resolves the HarborClient root directory inside a repository.
 *
 * @param repoPath - Repository root path.
 * @param subdir - Configured subdirectory (for example `.harborclient`).
 * @returns Absolute path to the HarborClient data root.
 */
export function resolveHarborclientRoot(repoPath: string, subdir: string): string {
  const trimmed = subdir.trim();
  if (!trimmed || trimmed === '.') {
    return repoPath;
  }
  return join(repoPath, trimmed);
}

/**
 * Ensures the HarborClient directory layout exists and writes a default .gitignore.
 *
 * @param root - HarborClient data root.
 */
export function ensureHarborclientLayout(root: string): void {
  mkdirSync(root, { recursive: true });
  const gitignorePath = join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${DEFAULT_HARBORCLIENT_GITIGNORE}\n`, 'utf-8');
  }
}

/**
 * Writes an environment export file at the Harbor data root.
 *
 * @param root - HarborClient data root.
 * @param data - Environment export payload.
 */
export function writeEnvironmentFile(root: string, data: EnvironmentExport): void {
  mkdirSync(root, { recursive: true });
  const uuid = resolveImportUuid(data.uuid);
  assertExportFilenameAvailable(root, 'environment', data.name, uuid);
  const targetPath = environmentFilePath(root, data.name);
  writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
  removeStaleExportFilesForUuid(root, 'environment', uuid, targetPath);
}

/**
 * Reads all environment export files under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function readAllEnvironments(root: string): EnvironmentExport[] {
  if (!existsSync(root)) {
    return [];
  }

  const environments: EnvironmentExport[] = [];
  for (const fileName of readdirSync(root)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const envPath = join(root, fileName);
    const parsed = readJsonFile(envPath);
    if (parseHarborExportKind(parsed) !== 'environment') {
      continue;
    }
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
  if (!existsSync(root)) {
    return;
  }

  const normalizedUuid = resolveImportUuid(uuid);
  for (const entry of listManagedHarborExportFiles(root)) {
    if (entry.kind === 'environment' && entry.uuid === normalizedUuid) {
      rmSync(entry.filePath, { force: true });
    }
  }
}

/**
 * Writes a snippet export file at the Harbor data root.
 *
 * @param root - HarborClient data root.
 * @param data - Snippet export payload.
 */
export function writeSnippetFile(root: string, data: SnippetExport): void {
  mkdirSync(root, { recursive: true });
  const uuid = resolveImportUuid(data.uuid);
  assertExportFilenameAvailable(root, 'snippet', data.name, uuid);
  const targetPath = snippetFilePath(root, data.name);
  writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
  removeStaleExportFilesForUuid(root, 'snippet', uuid, targetPath);
}

/**
 * Reads all snippet export files under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function readAllSnippets(root: string): SnippetExport[] {
  if (!existsSync(root)) {
    return [];
  }

  const snippets: SnippetExport[] = [];
  for (const fileName of readdirSync(root)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const snippetPath = join(root, fileName);
    const parsed = readJsonFile(snippetPath);
    if (parseHarborExportKind(parsed) !== 'snippet') {
      continue;
    }
    snippets.push(validateSnippetExport(parsed));
  }
  return snippets;
}

/**
 * Deletes a snippet file by uuid.
 *
 * @param root - HarborClient data root.
 * @param uuid - Snippet uuid.
 */
export function deleteSnippetFile(root: string, uuid: string): void {
  if (!existsSync(root)) {
    return;
  }

  for (const fileName of readdirSync(root)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const snippetPath = join(root, fileName);
    try {
      const parsed = readJsonFile(snippetPath);
      const exportData = validateSnippetExport(parsed);
      if (resolveImportUuid(exportData.uuid) === uuid) {
        rmSync(snippetPath, { force: true });
      }
    } catch {
      // Ignore invalid snippet files when deleting by uuid.
    }
  }
}

/**
 * Folder row used when creating folders in git-backed collections.
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

  /**
   * Folder-scoped variables for {{key}} substitution in requests.
   */
  variables?: Variable[];

  /**
   * Headers sent with every request in this folder.
   */
  headers?: KeyValue[];

  /**
   * Default Authorization settings inherited by requests unless overridden.
   */
  auth?: AuthConfig;

  /**
   * JavaScript run before every request in this folder.
   */
  pre_request_script?: string;

  /**
   * JavaScript run after every request in this folder.
   */
  post_request_script?: string;

  /**
   * Ordered folder pre-request scripts.
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Ordered folder post-request scripts.
   */
  post_request_scripts?: ScriptRef[];

  /**
   * Optional sidebar color for visual grouping.
   */
  color?: string | null;
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
    sort_order,
    variables: [],
    headers: [],
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: []
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

/**
 * Returns true when a repository-relative path is a HarborClient export JSON file.
 *
 * @param filepath - Repository-relative path.
 * @param harborSubdir - HarborClient subdirectory prefix.
 */
export function isHarborExportJsonPath(filepath: string, harborSubdir: string): boolean {
  const normalized = filepath.replace(/\\/g, '/');
  const prefix = harborSubdir === '.' ? '' : `${harborSubdir}/`;
  if (harborSubdir !== '.' && !normalized.startsWith(prefix)) {
    return false;
  }

  const relative = harborSubdir === '.' ? normalized : normalized.slice(prefix.length);
  return relative.endsWith('.json') && !relative.includes('/');
}

/**
 * Parses a collection uuid from a repository-relative collection export path.
 *
 * Uuids are stored inside export JSON files; callers must read file contents when needed.
 *
 * @param filepath - Repository-relative path to a root collection JSON file.
 * @param harborSubdir - HarborClient subdirectory prefix.
 */
export function parseCollectionUuidFromExportPath(
  filepath: string,
  harborSubdir: string
): string | null {
  if (!isHarborExportJsonPath(filepath, harborSubdir)) {
    return null;
  }
  return null;
}
