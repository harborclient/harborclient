import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import {
  maskVariablesForExport,
  validateCollectionExport,
  validateEnvironmentExport
} from '#/main/storage/collectionData';
import { validateSnippetExport } from '#/main/storage/snippetData';
import { generateDocumentUuid, resolveImportUuid } from '#/main/storage/uuid';
import { collectionDirName, exportFileBaseName, stripMdExtension, toFileSlug } from './slug';
import { validateRequestExport } from '#/main/storage/collectionData';
import type {
  CollectionExport,
  EnvironmentExport,
  ExportedDocument,
  ExportedRequest,
  SnippetExport
} from '#/shared/types';
import type { RequestExport } from '#/shared/types/request';
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
 * @param fileName - On-disk markdown file name at the harbor root.
 */
export function documentFilePath(harborRoot: string, fileName: string): string {
  const safeName = documentFileName(fileName);
  const resolvedRoot = resolve(harborRoot);
  const resolvedPath = resolve(join(resolvedRoot, safeName));
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}/`)) {
    throw new Error('Document name escapes the HarborClient root');
  }
  return resolvedPath;
}

/**
 * Builds a disambiguated harbor-root markdown file name for a second collection
 * that shares a display name with an existing document.
 *
 * @param displayName - User-facing document title (for example README.md).
 * @param collectionName - Owning collection display name.
 * @returns On-disk name like `README-api.md`.
 */
export function disambiguatedDocumentFileName(displayName: string, collectionName: string): string {
  const base = stripMdExtension(documentFileName(displayName));
  return `${base}-${toFileSlug(collectionName)}.md`;
}

/**
 * Resolves the harbor-root on-disk file name for one collection document.
 *
 * Uses the canonical display filename when available. When another collection
 * already owns that file, returns `{base}-{collection-slug}.md`. Existing
 * on-disk names owned by the same document uuid are preserved across saves.
 *
 * @param harborRoot - HarborClient data root.
 * @param collectionName - Owning collection display name.
 * @param displayName - User-facing document title shown in the sidebar.
 * @param ownerUuid - Document uuid allowed to keep an existing file slot.
 * @returns Case-preserving markdown file name at the harbor root.
 */
export function resolveDocumentDiskFileName(
  harborRoot: string,
  collectionName: string,
  displayName: string,
  ownerUuid: string
): string {
  const canonical = documentFileName(displayName);
  const normalizedOwnerUuid = resolveImportUuid(ownerUuid);
  const filenameMap = buildFilenameToDocumentMap(harborRoot);

  for (const entry of filenameMap.values()) {
    if (entry.uuid !== normalizedOwnerUuid) {
      continue;
    }
    if (documentFileName(entry.name).toLowerCase() === canonical.toLowerCase()) {
      return entry.fileName;
    }
    break;
  }

  const existing = filenameMap.get(canonical.toLowerCase());
  if (existing == null || existing.uuid === normalizedOwnerUuid) {
    return canonical;
  }

  const disambiguated = disambiguatedDocumentFileName(displayName, collectionName);
  const existingDisambiguated = filenameMap.get(disambiguated.toLowerCase());
  if (existingDisambiguated == null || existingDisambiguated.uuid === normalizedOwnerUuid) {
    return disambiguated;
  }

  throw new Error(
    `A markdown document named "${disambiguated}" already exists in this repository.`
  );
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
  if (!relative.endsWith('.md')) {
    return false;
  }

  const parts = relative.split('/');
  if (parts.length === 2 && parts[0].startsWith('collection-')) {
    return true;
  }
  if (parts.length === 1) {
    const baseName = parts[0];
    return !HARBOR_ROOT_RESERVED_NAMES.has(baseName);
  }

  return false;
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
 * On-disk collection manifest file name inside a collection folder.
 */
export const COLLECTION_MANIFEST_FILE = 'collection.json';

/**
 * Classified kind for one HarborClient path in git status or commit views.
 */
export type HarborChangeKind =
  | 'request'
  | 'document'
  | 'collectionMeta'
  | 'environment'
  | 'snippet'
  | 'other';

/**
 * Parsed HarborClient path metadata for filtering and display labels.
 */
export interface ClassifiedHarborChangePath {
  /**
   * High-level resource category for the path.
   */
  kind: HarborChangeKind;

  /**
   * Collection folder segment when the path is inside `collection-<slug>/`.
   */
  collectionDir?: string;

  /**
   * File name relative to the harbor root or collection folder.
   */
  fileName: string;
}

/**
 * Document metadata stored in collection.json for one mirrored markdown file.
 */
export interface StoredDocumentRef {
  /**
   * Markdown file name at the Harbor data root (may be disambiguated).
   */
  file: string;

  /**
   * Stable document uuid.
   */
  uuid: string;

  /**
   * User-facing document title shown in the sidebar (for example README.md).
   */
  name: string;

  /**
   * Owning folder uuid, or null at collection root.
   */
  folder_uuid: string | null;

  /**
   * Position among sibling container items.
   */
  sort_order: number;

  /**
   * Optional sidebar color.
   */
  color: string | null;
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
 * Returns the on-disk collection folder name for a display name.
 *
 * @param name - Collection display name.
 */
export { collectionDirName };

/**
 * Returns the absolute path to one collection folder at the harbor root.
 *
 * @param root - HarborClient data root.
 * @param name - Collection display name.
 */
export function collectionDirPath(root: string, name: string): string {
  return join(root, collectionDirName(name));
}

/**
 * Returns the absolute path to `collection.json` inside a collection folder.
 *
 * @param dirPath - Absolute collection folder path.
 */
export function collectionManifestPath(dirPath: string): string {
  return join(dirPath, COLLECTION_MANIFEST_FILE);
}

/**
 * Returns the absolute path for a markdown document inside a collection folder.
 *
 * @param dirPath - Absolute collection folder path.
 * @param displayName - User-facing document title.
 */
export function collectionDocumentFilePath(dirPath: string, displayName: string): string {
  const fileName = documentFileName(displayName);
  const resolvedDir = resolve(dirPath);
  const resolvedPath = resolve(join(resolvedDir, fileName));
  if (resolvedPath !== resolvedDir && !resolvedPath.startsWith(`${resolvedDir}/`)) {
    throw new Error('Document name escapes the collection folder');
  }
  return resolvedPath;
}

/**
 * Returns true when a collection folder name would match gitignore local-override globs.
 *
 * @param dirName - Collection folder base name.
 */
export function isGitignoredCollectionDirName(dirName: string): boolean {
  return isGitignoredHarborExportFileName(`${dirName}.json`);
}

/**
 * Ensures a collection folder name is available at the harbor root.
 *
 * @param harborRoot - HarborClient data root.
 * @param name - Candidate collection display name.
 * @param ownerUuid - Collection uuid allowed to keep the folder name.
 */
export function assertCollectionDirAvailable(
  harborRoot: string,
  name: string,
  ownerUuid: string
): void {
  const dirName = collectionDirName(name);
  if (isGitignoredCollectionDirName(dirName)) {
    throw new Error(
      `The collection name "${name.trim()}" would create folder "${dirName}", which is ignored by the HarborClient .gitignore. Choose a different name.`
    );
  }

  const normalizedOwnerUuid = resolveImportUuid(ownerUuid);
  for (const entry of listCollectionFoldersOnDisk(harborRoot)) {
    if (basename(entry.dirPath) !== dirName) {
      continue;
    }
    if (entry.uuid !== normalizedOwnerUuid) {
      throw new Error(`A collection folder named "${dirName}" already exists in this repository.`);
    }
  }
}

/**
 * Classifies one file path inside a collection folder.
 *
 * @param innerPath - Path relative to the collection directory.
 */
function classifyCollectionInnerPath(
  innerPath: string
): Pick<ClassifiedHarborChangePath, 'kind' | 'fileName'> | null {
  if (innerPath === COLLECTION_MANIFEST_FILE) {
    return { kind: 'collectionMeta', fileName: innerPath };
  }
  if (innerPath.startsWith('req-') && innerPath.endsWith('.json')) {
    return { kind: 'request', fileName: innerPath };
  }
  if (innerPath.endsWith('.md') && !innerPath.includes('/')) {
    return { kind: 'document', fileName: innerPath };
  }
  return null;
}

/**
 * Returns whether a collection-inner path is a request or markdown document file.
 *
 * @param innerPath - Path relative to the collection directory.
 */
export function isCollectionRequestOrDocumentFile(innerPath: string): boolean {
  const classified = classifyCollectionInnerPath(innerPath);
  return classified != null && (classified.kind === 'request' || classified.kind === 'document');
}

/**
 * Classifies a repository-relative HarborClient path for git UI filtering.
 *
 * @param filepath - Repository-relative path.
 * @param harborSubdir - HarborClient subdirectory prefix.
 */
export function classifyHarborChangePath(
  filepath: string,
  harborSubdir: string
): ClassifiedHarborChangePath | null {
  const normalized = filepath.replace(/\\/g, '/');
  const prefix =
    harborSubdir === '.' ? '' : `${harborSubdir.replace(/\\/g, '/').replace(/\/+$/, '')}/`;
  if (harborSubdir !== '.' && !normalized.startsWith(prefix)) {
    return null;
  }

  const relative = harborSubdir === '.' ? normalized : normalized.slice(prefix.length);
  if (!relative || relative === '.gitignore') {
    return relative === '.gitignore' ? { kind: 'other', fileName: '.gitignore' } : null;
  }

  if (!relative.includes('/')) {
    if (relative.endsWith('.json')) {
      if (relative.startsWith('environment-')) {
        return { kind: 'environment', fileName: relative };
      }
      if (relative.startsWith('snippet-')) {
        return { kind: 'snippet', fileName: relative };
      }
    }
    if (relative.endsWith('.md') && !HARBOR_ROOT_RESERVED_NAMES.has(relative)) {
      return { kind: 'document', fileName: relative };
    }
    return { kind: 'other', fileName: relative };
  }

  const slashIndex = relative.indexOf('/');
  const collectionDir = relative.slice(0, slashIndex);
  const innerPath = relative.slice(slashIndex + 1);
  if (!collectionDir.startsWith('collection-')) {
    return { kind: 'other', fileName: relative };
  }

  const innerClassified = classifyCollectionInnerPath(innerPath);
  if (innerClassified) {
    return { ...innerClassified, collectionDir };
  }

  return { kind: 'other', fileName: innerPath };
}

/**
 * Request display metadata parsed from one request export JSON string.
 */
interface ParsedRequestMeta {
  /**
   * Stable request uuid when present in the export JSON.
   */
  uuid: string | null;

  /**
   * User-facing request name when present in the export JSON.
   */
  name: string | null;

  /**
   * HTTP method when present in the export JSON.
   */
  method: string | null;
}

/**
 * Parses request display metadata from one request export JSON string.
 *
 * @param text - Request export JSON text.
 */
function parseRequestMetaFromText(text: string | null): ParsedRequestMeta {
  if (text == null || !text.trim()) {
    return { uuid: null, name: null, method: null };
  }
  const parsed = parseJson(
    text,
    null as { uuid?: unknown; name?: unknown; method?: unknown } | null
  );
  if (parsed == null) {
    return { uuid: null, name: null, method: null };
  }
  const uuid =
    typeof parsed.uuid === 'string' && parsed.uuid.trim() ? resolveImportUuid(parsed.uuid) : null;
  const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null;
  const method =
    typeof parsed.method === 'string' && parsed.method.trim() ? parsed.method.trim() : null;
  return { uuid, name, method };
}

/**
 * Parses the stable request uuid from one request export JSON string.
 *
 * @param text - Request export JSON text.
 */
export function parseRequestUuidFromText(text: string | null): string | null {
  return parseRequestMetaFromText(text).uuid;
}

/**
 * Parses a document display name from collection manifest JSON and file name.
 *
 * @param manifestText - `collection.json` text for the owning collection folder.
 * @param fileName - Markdown file name inside the collection folder.
 */
function parseDocumentDisplayNameFromManifest(
  manifestText: string | null,
  fileName: string
): string | null {
  if (manifestText == null || !manifestText.trim()) {
    return null;
  }
  const parsed = parseJson(manifestText, null as { documents?: StoredDocumentRef[] } | null);
  if (parsed == null) {
    return null;
  }
  for (const document of parsed.documents ?? []) {
    if (document.file.toLowerCase() === fileName.toLowerCase() && document.name.trim()) {
      return document.name.trim();
    }
  }
  return null;
}

/**
 * Builds user-facing display metadata for one classified Harbor change path.
 *
 * @param classified - Parsed HarborClient path metadata.
 * @param contentText - Decoded file content at the relevant git ref.
 * @param manifestText - Optional `collection.json` text for document rows.
 */
export function displayNameFromHarborChange(
  classified: ClassifiedHarborChangePath,
  contentText: string | null,
  manifestText: string | null = null
): { displayName: string; resourceKind: 'request' | 'document'; method?: string } {
  if (classified.kind === 'request') {
    const parsedMeta = parseRequestMetaFromText(contentText);
    const fallback = classified.fileName.replace(/^req-/i, '').replace(/\.json$/i, '');
    return {
      displayName: parsedMeta.name ?? fallback,
      resourceKind: 'request',
      ...(parsedMeta.method != null ? { method: parsedMeta.method } : {})
    };
  }

  const manifestName = parseDocumentDisplayNameFromManifest(manifestText, classified.fileName);
  const fallback = classified.fileName.replace(/\.md$/i, '');
  return {
    displayName: manifestName ?? fallback,
    resourceKind: 'document'
  };
}

/**
 * Reads the stable request uuid from one request export JSON file.
 *
 * @param filePath - Absolute path to the request JSON file.
 */
function readRequestUuidFromFile(filePath: string): string | null {
  try {
    const parsed = readJsonFile(filePath) as { harborclientExport?: string; uuid?: string };
    if (parsed.harborclientExport !== 'request') {
      return null;
    }
    if (typeof parsed.uuid !== 'string' || !parsed.uuid.trim()) {
      return null;
    }
    return resolveImportUuid(parsed.uuid);
  } catch {
    return null;
  }
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
 * Picks a unique JSON file name within one collection folder.
 *
 * @param baseName - Desired file name ending in `.json`.
 * @param usedNames - Lowercase file names already reserved in the folder.
 */
function uniqueFileNameInFolder(baseName: string, usedNames: Set<string>): string {
  const stem = baseName.replace(/\.json$/i, '');
  let candidate = baseName;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem}-${counter}.json`;
    counter += 1;
  }
  return candidate;
}

/**
 * Maps existing request uuids to on-disk file names inside a collection folder.
 *
 * @param dirPath - Absolute collection folder path.
 */
export function buildExistingRequestFileMap(dirPath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(dirPath)) {
    return map;
  }

  for (const fileName of readdirSync(dirPath)) {
    if (!fileName.startsWith('req-') || !fileName.endsWith('.json')) {
      continue;
    }
    try {
      const parsed = readJsonFile(join(dirPath, fileName)) as {
        harborclientExport?: string;
        uuid?: string;
      };
      if (parsed.harborclientExport !== 'request') {
        continue;
      }
      const uuid = resolveImportUuid(String(parsed.uuid ?? ''));
      if (uuid) {
        map.set(uuid, fileName);
      }
    } catch {
      // Ignore invalid request files when rebuilding the uuid map.
    }
  }

  return map;
}

/**
 * Reads markdown document file refs from a collection manifest on disk.
 *
 * @param dirPath - Absolute collection folder path.
 */
export function readStoredDocumentRefs(dirPath: string): StoredDocumentRef[] {
  const manifestPath = collectionManifestPath(dirPath);
  if (!existsSync(manifestPath)) {
    return [];
  }

  const parsed = readJsonFile(manifestPath) as { documents?: StoredDocumentRef[] } | null;
  return parsed?.documents ?? [];
}

/**
 * Resolves the on-disk request JSON file name for one export row.
 *
 * Request files are keyed by stable uuid so display-name renames stay in place
 * as content modifications of one tracked git file.
 *
 * @param request - Request export row to persist.
 * @param usedNames - Lowercase file names already reserved in the folder.
 */
function resolveRequestFileName(request: ExportedRequest, usedNames: Set<string>): string {
  const uuid = resolveImportUuid(request.uuid);
  const desired = `req-${uuid}.json`;
  let fileName = desired;
  if (usedNames.has(fileName.toLowerCase())) {
    fileName = uniqueFileNameInFolder(desired, usedNames);
  }
  usedNames.add(fileName.toLowerCase());
  return fileName;
}

/**
 * Recovers unreferenced request JSON files from a collection folder into the export.
 *
 * Orphan files whose uuid already appears in the manifest-backed request list are
 * ignored as stale rename leftovers. Files with a new uuid are appended so buried
 * requests resurface instead of being swept on the next save.
 *
 * @param dirPath - Absolute collection folder path.
 * @param manifestRequestFiles - Request file names listed in `collection.json`.
 * @param requests - Mutable request rows loaded from the manifest.
 */
function recoverOrphanRequestFiles(
  dirPath: string,
  manifestRequestFiles: string[],
  requests: ExportedRequest[]
): void {
  if (!existsSync(dirPath)) {
    return;
  }

  const manifestFileSet = new Set(manifestRequestFiles.map((fileName) => fileName.toLowerCase()));
  const knownUuids = new Set(requests.map((row) => resolveImportUuid(row.uuid)));

  for (const fileName of readdirSync(dirPath)) {
    if (!fileName.startsWith('req-') || !fileName.endsWith('.json')) {
      continue;
    }
    if (manifestFileSet.has(fileName.toLowerCase())) {
      continue;
    }

    const requestPath = join(dirPath, fileName);
    let requestParsed: Record<string, unknown>;
    try {
      requestParsed = normalizeScriptRefFields(
        readJsonFile(requestPath) as Record<string, unknown>
      );
    } catch {
      continue;
    }

    let validated: RequestExport;
    try {
      validated = validateRequestExport(requestParsed);
    } catch {
      continue;
    }

    const uuid = resolveImportUuid(validated.uuid);
    if (!uuid || knownUuids.has(uuid)) {
      continue;
    }

    const folderUuid =
      typeof requestParsed.folder_uuid === 'string'
        ? requestParsed.folder_uuid
        : requestParsed.folder_uuid === null
          ? null
          : undefined;

    knownUuids.add(uuid);
    requests.push({
      ...validated,
      uuid,
      sort_order: requests.length,
      folder_uuid: folderUuid ?? null,
      folder_name: null
    });
  }
}

/**
 * Reads and validates a collection folder into one inline collection export.
 *
 * @param dirPath - Absolute path to the collection folder.
 */
export function readCollectionFromFolder(dirPath: string): CollectionExport {
  const manifestPath = collectionManifestPath(dirPath);
  const parsed = readJsonFile(manifestPath) as Record<string, unknown>;
  if (parseHarborExportKind(parsed) !== 'collection') {
    throw new Error(`Expected a collection export in ${manifestPath}`);
  }

  const requestFiles = Array.isArray(parsed.requests)
    ? parsed.requests.filter((row): row is string => typeof row === 'string')
    : [];
  const requests: ExportedRequest[] = [];

  for (const [index, fileName] of requestFiles.entries()) {
    const requestPath = join(dirPath, fileName);
    if (!existsSync(requestPath)) {
      continue;
    }
    const requestParsed = normalizeScriptRefFields(
      readJsonFile(requestPath) as Record<string, unknown>
    );
    const validated = validateRequestExport(requestParsed);
    const folderUuid =
      typeof requestParsed.folder_uuid === 'string'
        ? requestParsed.folder_uuid
        : requestParsed.folder_uuid === null
          ? null
          : undefined;
    requests.push({
      ...validated,
      uuid: validated.uuid,
      sort_order: index,
      folder_uuid: folderUuid ?? null,
      folder_name: null
    });
  }

  recoverOrphanRequestFiles(dirPath, requestFiles, requests);

  const documentsRaw = Array.isArray(parsed.documents) ? parsed.documents : [];
  const harborRoot = dirname(dirPath);
  const documents: ExportedDocument[] = documentsRaw
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row, index) => {
      const file =
        typeof row.file === 'string' ? row.file : documentFileName(String(row.name ?? ''));
      let mdPath = join(harborRoot, file);
      if (!existsSync(mdPath)) {
        // Legacy layouts stored markdown inside the collection folder.
        mdPath = join(dirPath, file);
      }
      let content = String(row.content ?? '');
      if (!content.trim() && existsSync(mdPath)) {
        content = readFileSync(mdPath, 'utf-8');
      }
      return {
        uuid: typeof row.uuid === 'string' ? resolveImportUuid(row.uuid) : undefined,
        name: String(row.name ?? '').trim(),
        content,
        sort_order:
          typeof row.sort_order === 'number' && Number.isFinite(row.sort_order)
            ? row.sort_order
            : index,
        folder_uuid:
          row.folder_uuid == null || row.folder_uuid === ''
            ? null
            : typeof row.folder_uuid === 'string'
              ? row.folder_uuid
              : null,
        color:
          row.color == null ? null : typeof row.color === 'string' ? row.color.trim() || null : null
      };
    })
    .filter((row) => row.name.length > 0);

  const foldersRaw = Array.isArray(parsed.folders) ? parsed.folders : [];
  const folders = foldersRaw
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((folder, index) => ({
      uuid: typeof folder.uuid === 'string' ? resolveImportUuid(folder.uuid) : undefined,
      name: String(folder.name ?? '').trim(),
      sort_order:
        typeof folder.sort_order === 'number' && Number.isFinite(folder.sort_order)
          ? folder.sort_order
          : index,
      variables: (folder.variables as Variable[] | undefined) ?? [],
      headers: (folder.headers as KeyValue[] | undefined) ?? [],
      auth: (folder.auth as AuthConfig | undefined) ?? defaultAuth(),
      pre_request_script: String(folder.pre_request_script ?? ''),
      post_request_script: String(folder.post_request_script ?? ''),
      pre_request_scripts: Array.isArray(folder.pre_request_scripts)
        ? (folder.pre_request_scripts as ScriptRef[])
        : readScriptRefsFromJson(
            typeof folder.pre_request_scripts === 'string' ? folder.pre_request_scripts : undefined,
            String(folder.pre_request_script ?? '')
          ),
      post_request_scripts: Array.isArray(folder.post_request_scripts)
        ? (folder.post_request_scripts as ScriptRef[])
        : readScriptRefsFromJson(
            typeof folder.post_request_scripts === 'string'
              ? folder.post_request_scripts
              : undefined,
            String(folder.post_request_script ?? '')
          ),
      color:
        folder.color == null
          ? null
          : typeof folder.color === 'string'
            ? folder.color.trim() || null
            : null
    }))
    .filter((row) => row.name.length > 0);

  return validateCollectionExport({
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: typeof parsed.uuid === 'string' ? resolveImportUuid(parsed.uuid) : undefined,
    name: String(parsed.name ?? ''),
    color:
      parsed.color == null
        ? null
        : typeof parsed.color === 'string'
          ? parsed.color.trim() || null
          : null,
    variables: (parsed.variables as CollectionExport['variables']) ?? [],
    headers: (parsed.headers as CollectionExport['headers']) ?? [],
    auth: parsed.auth as CollectionExport['auth'],
    pre_request_script: String(parsed.pre_request_script ?? ''),
    post_request_script: String(parsed.post_request_script ?? ''),
    pre_request_scripts: Array.isArray(parsed.pre_request_scripts)
      ? (parsed.pre_request_scripts as ScriptRef[])
      : readScriptRefsFromJson(
          typeof parsed.pre_request_scripts === 'string' ? parsed.pre_request_scripts : undefined,
          String(parsed.pre_request_script ?? '')
        ),
    post_request_scripts: Array.isArray(parsed.post_request_scripts)
      ? (parsed.post_request_scripts as ScriptRef[])
      : readScriptRefsFromJson(
          typeof parsed.post_request_scripts === 'string' ? parsed.post_request_scripts : undefined,
          String(parsed.post_request_script ?? '')
        ),
    folders,
    requests: collapseDuplicateRequests(requests),
    documents
  });
}

/**
 * Writes a validated collection export to a collection folder with per-request JSON files.
 *
 * @param root - HarborClient data root.
 * @param exportData - Collection export payload to persist.
 * @param options - Optional previous folder path to remove after a rename.
 * @returns Absolute path to the collection folder written on disk.
 */
export function writeCollectionToFolder(
  root: string,
  exportData: CollectionExport,
  options?: { previousDirPath?: string | null }
): string {
  mkdirSync(root, { recursive: true });
  const validated = validateCollectionExport(exportData);
  const uuid = resolveImportUuid(validated.uuid);
  assertCollectionDirAvailable(root, validated.name, uuid);

  const dirPath = collectionDirPath(root, validated.name);
  const previousDirPath = options?.previousDirPath ?? null;
  const usedNames = new Set<string>();
  const requestFileNames: string[] = [];
  const writtenRequestFiles = new Set<string>();
  const writtenHarborDocumentFiles = new Set<string>();
  const previousDocumentFiles = new Set<string>();
  for (const refsDir of [dirPath, previousDirPath]) {
    if (!refsDir) {
      continue;
    }
    for (const document of readStoredDocumentRefs(refsDir)) {
      const fileName = document.file.trim();
      if (fileName) {
        previousDocumentFiles.add(fileName);
      }
    }
  }

  mkdirSync(dirPath, { recursive: true });

  for (const request of validated.requests ?? []) {
    const fileName = resolveRequestFileName(request, usedNames);
    requestFileNames.push(fileName);
    writtenRequestFiles.add(fileName);

    const requestPayload = validateRequestExport({
      harborclientVersion: 1,
      harborclientExport: 'request',
      uuid: resolveImportUuid(request.uuid),
      name: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers,
      params: request.params,
      auth: request.auth,
      body: request.body,
      body_type: request.body_type,
      pre_request_script: request.pre_request_script,
      post_request_script: request.post_request_script,
      pre_request_scripts: request.pre_request_scripts,
      post_request_scripts: request.post_request_scripts,
      comment: request.comment,
      tags: request.tags,
      color: request.color ?? null
    });

    writeFileSync(
      join(dirPath, fileName),
      JSON.stringify(
        {
          ...requestPayload,
          folder_uuid: request.folder_uuid ?? null
        },
        null,
        2
      ),
      'utf-8'
    );
  }

  const documentRefs: StoredDocumentRef[] = (validated.documents ?? []).map((document, index) => {
    const documentUuid = resolveImportUuid(document.uuid);
    const file = resolveDocumentDiskFileName(root, validated.name, document.name, documentUuid);
    writtenHarborDocumentFiles.add(file);
    writeFileSync(documentFilePath(root, file), document.content ?? '', 'utf-8');
    return {
      file,
      uuid: documentUuid,
      name: document.name,
      folder_uuid: document.folder_uuid ?? null,
      sort_order:
        typeof document.sort_order === 'number' && Number.isFinite(document.sort_order)
          ? document.sort_order
          : index,
      color: document.color ?? null
    };
  });

  const manifest = {
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid,
    name: validated.name,
    color: validated.color ?? null,
    variables: maskVariablesForExport(validated.variables),
    headers: validated.headers,
    auth: validated.auth,
    pre_request_script: validated.pre_request_script,
    post_request_script: validated.post_request_script,
    pre_request_scripts: validated.pre_request_scripts,
    post_request_scripts: validated.post_request_scripts,
    folders: (validated.folders ?? []).map((folder) => ({
      ...folder,
      variables: maskVariablesForExport(folder.variables ?? [])
    })),
    requests: requestFileNames,
    documents: documentRefs
  };

  const writtenRequestUuids = new Set(
    (validated.requests ?? []).map((request) => resolveImportUuid(request.uuid))
  );
  const previousManifestUuids = new Set<string>();
  const manifestPath = collectionManifestPath(dirPath);
  if (existsSync(manifestPath)) {
    const previousManifest = readJsonFile(manifestPath) as { requests?: string[] };
    for (const fileName of previousManifest.requests ?? []) {
      const previousUuid = readRequestUuidFromFile(join(dirPath, fileName));
      if (previousUuid != null) {
        previousManifestUuids.add(previousUuid);
      }
    }
  }
  const removedManifestUuids = new Set(
    [...previousManifestUuids].filter((requestUuid) => !writtenRequestUuids.has(requestUuid))
  );

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  for (const previousFile of previousDocumentFiles) {
    if (writtenHarborDocumentFiles.has(previousFile)) {
      continue;
    }
    rmSync(join(root, previousFile), { force: true });
  }

  if (existsSync(dirPath)) {
    for (const entry of readdirSync(dirPath)) {
      const entryPath = join(dirPath, entry);
      if (entry === COLLECTION_MANIFEST_FILE) {
        continue;
      }
      if (entry.startsWith('req-') && entry.endsWith('.json') && !writtenRequestFiles.has(entry)) {
        const orphanUuid = readRequestUuidFromFile(entryPath);
        if (
          orphanUuid != null &&
          (writtenRequestUuids.has(orphanUuid) || removedManifestUuids.has(orphanUuid))
        ) {
          rmSync(entryPath, { force: true });
        }
        continue;
      }
      // Migrate legacy in-collection markdown files to the harbor root.
      if (entry.endsWith('.md')) {
        rmSync(entryPath, { force: true });
      }
    }
  }

  if (previousDirPath && previousDirPath !== dirPath && existsSync(previousDirPath)) {
    rmSync(previousDirPath, { recursive: true, force: true });
  }

  removeStaleCollectionFoldersForUuid(root, uuid, dirPath);

  return dirPath;
}

/**
 * Removes stale collection folders that share a uuid after a rename.
 *
 * @param root - HarborClient data root.
 * @param uuid - Collection uuid.
 * @param keepDirPath - Folder path that should remain on disk.
 */
function removeStaleCollectionFoldersForUuid(
  root: string,
  uuid: string,
  keepDirPath: string
): void {
  if (!existsSync(root)) {
    return;
  }

  for (const entry of listCollectionFoldersOnDisk(root)) {
    if (entry.uuid === uuid && entry.dirPath !== keepDirPath) {
      rmSync(entry.dirPath, { recursive: true, force: true });
    }
  }
}

/**
 * Lists collection uuids discovered as collection folders on disk.
 *
 * @param root - HarborClient data root.
 */
export function listCollectionUuidsOnDisk(root: string): string[] {
  return listCollectionFoldersOnDisk(root).map((entry) => entry.uuid);
}

/**
 * One collection folder discovered at the Harbor data root.
 */
export interface CollectionFolderEntry {
  /**
   * Stable collection uuid from `collection.json`.
   */
  uuid: string;

  /**
   * Absolute path to the collection folder.
   */
  dirPath: string;
}

/**
 * Lists collection folders at the Harbor data root.
 *
 * @param root - HarborClient data root.
 */
export function listCollectionFoldersOnDisk(root: string): CollectionFolderEntry[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries: CollectionFolderEntry[] = [];
  for (const dirName of readdirSync(root)) {
    if (!dirName.startsWith('collection-')) {
      continue;
    }
    const dirPath = join(root, dirName);
    const manifestPath = collectionManifestPath(dirPath);
    if (!existsSync(manifestPath)) {
      continue;
    }
    try {
      const parsed = readJsonFile(manifestPath) as { harborclientExport?: string; uuid?: string };
      if (parsed.harborclientExport !== 'collection') {
        continue;
      }
      const uuid = resolveImportUuid(String(parsed.uuid ?? ''));
      if (!uuid) {
        continue;
      }
      entries.push({ uuid, dirPath });
    } catch {
      // Ignore invalid collection folders during discovery scans.
    }
  }

  return entries;
}

/**
 * Finds a collection folder path by uuid under a HarborClient root.
 *
 * @param root - HarborClient data root.
 * @param uuid - Collection uuid to locate.
 */
export function findCollectionDirByUuid(root: string, uuid: string): string | null {
  const normalizedUuid = resolveImportUuid(uuid).toLowerCase();
  for (const entry of listCollectionFoldersOnDisk(root)) {
    if (entry.uuid.toLowerCase() === normalizedUuid) {
      return entry.dirPath;
    }
  }
  return null;
}

/**
 * Lists all managed markdown documents across collections at the Harbor data root.
 *
 * @param harborRoot - HarborClient data root.
 */
export function listManagedHarborRootDocuments(harborRoot: string): HarborRootDocumentEntry[] {
  const documents: HarborRootDocumentEntry[] = [];

  for (const entry of listCollectionFoldersOnDisk(harborRoot)) {
    for (const document of readStoredDocumentRefs(entry.dirPath)) {
      const docUuid = resolveImportUuid(document.uuid);
      const fileName = document.file.trim();
      if (!docUuid || !document.name.trim() || !fileName) {
        continue;
      }
      const filePath = documentFilePath(harborRoot, fileName);
      documents.push({
        uuid: docUuid,
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
 * Ensures a document display name is available inside one collection.
 *
 * @param collectionDir - Absolute path to the collection folder.
 * @param displayName - Candidate document display name.
 * @param ownerUuid - Document uuid that is allowed to keep the display name.
 * @throws When another document in the same collection already owns the display name.
 */
export function assertDocumentFilenameAvailable(
  collectionDir: string,
  displayName: string,
  ownerUuid: string
): void {
  const normalizedDisplayName = documentFileName(displayName);
  const normalizedOwnerUuid = resolveImportUuid(ownerUuid);
  const manifestPath = collectionManifestPath(collectionDir);
  if (!existsSync(manifestPath)) {
    return;
  }

  const manifest = readJsonFile(manifestPath) as { documents?: StoredDocumentRef[] };
  for (const document of manifest.documents ?? []) {
    if (documentFileName(document.name).toLowerCase() !== normalizedDisplayName.toLowerCase()) {
      continue;
    }
    if (resolveImportUuid(document.uuid) !== normalizedOwnerUuid) {
      throw new Error(
        `A markdown document named "${normalizedDisplayName}" already exists in this collection.`
      );
    }
  }
}

/**
 * Reads markdown document export rows from one collection folder.
 *
 * @param harborRoot - HarborClient data root.
 * @param collectionUuid - Stable collection uuid.
 */
export function readDocumentsFromHarborRoot(
  harborRoot: string,
  collectionUuid: string
): ExportedDocument[] {
  const dirPath = findCollectionDirByUuid(harborRoot, collectionUuid);
  if (!dirPath) {
    return [];
  }

  const exportData = readCollectionFromFolder(dirPath);
  return (exportData.documents ?? []).sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
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
