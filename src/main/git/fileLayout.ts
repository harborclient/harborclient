import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs';
import { basename, join, resolve } from 'path';
import { maskVariablesForExport, validateCollectionExport } from '#/main/storage/collectionData';
import { validateEnvironmentExport } from '#/main/storage/collectionData';
import { validateSnippetExport } from '#/main/storage/snippetData';
import { validateRequestExport } from '#/main/storage/collectionData';
import { generateDocumentUuid, resolveImportUuid } from '#/main/storage/uuid';
import { uuidSlugPrefix } from '#/main/git/slug';
import type {
  CollectionExport,
  EnvironmentExport,
  ExportedDocument,
  ExportedFolder,
  ExportedRequest,
  RequestExport,
  SnippetExport
} from '#/shared/types';
import { parseJson } from '#/shared/parseJson';
import { readScriptRefsFromJson } from '#/shared/scriptRefs';
import type { AuthConfig } from '#/shared/auth';
import { defaultAuth } from '#/shared/auth';
import type { KeyValue, Variable } from '#/shared/types/common';
import type { ScriptRef } from '#/shared/types/script';

/**
 * YAML frontmatter fields stored in git-backed markdown document files.
 */
export interface StoredDocumentFrontmatter {
  /**
   * Stable document identifier.
   */
  uuid: string;

  /**
   * Stable collection uuid owning this document file.
   */
  collection_uuid: string;

  /**
   * User-facing document title (for example README.md).
   */
  name: string;

  /**
   * Portable folder uuid; omitted or null for collection root.
   */
  folder_uuid?: string | null;

  /**
   * Position among sibling documents.
   */
  sort_order: number;

  /**
   * Optional sidebar color for visual grouping.
   */
  color?: string | null;
}

/**
 * Parses a simple YAML scalar used by markdown frontmatter fields.
 *
 * @param value - Raw scalar value from a `key: value` line.
 * @returns Trimmed scalar with optional quote wrappers removed.
 */
function parseYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Returns the legacy documents directory path inside a collection directory.
 *
 * @param collectionDirectory - Absolute path to a collection directory.
 */
export function legacyDocumentsDir(collectionDirectory: string): string {
  return join(collectionDirectory, 'documents');
}

/**
 * Reserved top-level entries under a HarborClient data root.
 */
const HARBOR_ROOT_RESERVED_NAMES = new Set([
  'collections',
  'environments',
  'snippets',
  '.gitignore'
]);

/**
 * Returns true when a file name uses the legacy `{uuid}-{slug}.md` layout.
 *
 * @param fileName - Base file name at the Harbor data root.
 */
export function isLegacyUuidPrefixedDocumentFileName(fileName: string): boolean {
  if (!fileName.endsWith('.md')) {
    return false;
  }
  const base = fileName.slice(0, -3);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i.test(base);
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
 * Document metadata row stored in collection.json (content lives at the Harbor root).
 */
export interface StoredDocumentRow {
  /**
   * Stable document identifier.
   */
  uuid: string;

  /**
   * Display file name (for example README.md).
   */
  name: string;

  /**
   * Portable folder uuid; omitted or null for collection root.
   */
  folder_uuid?: string | null;

  /**
   * Position among sibling documents.
   */
  sort_order: number;

  /**
   * Optional sidebar color for visual grouping.
   */
  color?: string | null;
}

/**
 * Metadata for one managed markdown document file at the Harbor data root.
 */
export interface HarborRootDocumentEntry {
  /**
   * Stable document uuid from collection.json.
   */
  uuid: string;

  /**
   * Stable collection uuid owning this document.
   */
  collection_uuid: string;

  /**
   * User-facing document title from collection.json.
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
 * Parses stored document metadata rows from collection.json JSON.
 *
 * @param raw - Raw `documents` field from collection.json.
 */
export function parseStoredDocumentRows(raw: unknown): StoredDocumentRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const documents: StoredDocumentRow[] = [];
  for (const [index, row] of raw.entries()) {
    if (row == null || typeof row !== 'object') {
      continue;
    }
    const record = row as Record<string, unknown>;
    const uuid = typeof record.uuid === 'string' ? resolveImportUuid(record.uuid) : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!uuid || !name) {
      continue;
    }
    documents.push({
      uuid,
      name,
      folder_uuid:
        record.folder_uuid == null || record.folder_uuid === ''
          ? null
          : typeof record.folder_uuid === 'string'
            ? record.folder_uuid
            : null,
      sort_order:
        typeof record.sort_order === 'number' && Number.isFinite(record.sort_order)
          ? record.sort_order
          : index,
      color:
        record.color == null
          ? null
          : typeof record.color === 'string'
            ? record.color.trim() || null
            : null
    });
  }

  return documents;
}

/**
 * Reads document metadata rows from one collection directory.
 *
 * @param collectionDirectory - Absolute path to the collection directory.
 */
export function readDocumentMetadataFromCollectionDir(
  collectionDirectory: string
): StoredDocumentRow[] {
  const manifestPath = join(collectionDirectory, 'collection.json');
  if (!existsSync(manifestPath)) {
    return [];
  }

  const raw = readJsonFile(manifestPath) as Record<string, unknown>;
  return parseStoredDocumentRows(raw.documents);
}

/**
 * Converts an exported document row into collection.json metadata.
 *
 * @param document - Document export row with content.
 */
export function exportedDocumentToStoredRow(document: ExportedDocument): StoredDocumentRow {
  return {
    uuid: resolveImportUuid(document.uuid),
    name: document.name,
    folder_uuid: document.folder_uuid ?? null,
    sort_order: document.sort_order,
    color: document.color ?? null
  };
}

/**
 * Returns markdown body content, stripping legacy YAML frontmatter when present.
 *
 * @param raw - Full markdown file contents.
 */
export function readMarkdownDocumentBody(raw: string): string {
  return parseMarkdownFrontmatter(raw).body;
}

/**
 * Returns true when markdown content begins with a YAML frontmatter block.
 *
 * @param raw - Full markdown file contents.
 */
export function hasMarkdownFrontmatter(raw: string): boolean {
  const trimmed = raw.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---')) {
    return false;
  }
  return trimmed.indexOf('\n---', 3) >= 0;
}

/**
 * Parses a document uuid prefix from a legacy `{uuid}-{slug}.md` file name.
 *
 * @param fileName - Base file name at the Harbor data root.
 */
function parseLegacyDocumentUuidFromFileName(fileName: string): string | null {
  if (!isLegacyUuidPrefixedDocumentFileName(fileName)) {
    return null;
  }
  const base = fileName.slice(0, -3);
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(base);
  return match?.[1] ?? null;
}

/**
 * Resolves the on-disk markdown path for one managed document row.
 *
 * @param harborRoot - HarborClient data root.
 * @param row - Document metadata from collection.json.
 */
function resolveDocumentContentPath(harborRoot: string, row: StoredDocumentRow): string | null {
  const expectedPath = documentFilePath(harborRoot, row.name);
  if (existsSync(expectedPath)) {
    return expectedPath;
  }

  if (!existsSync(harborRoot)) {
    return null;
  }

  for (const fileName of readdirSync(harborRoot)) {
    const legacyUuid = parseLegacyDocumentUuidFromFileName(fileName);
    if (legacyUuid === row.uuid) {
      return join(harborRoot, fileName);
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
  const collectionsPath = collectionsDir(harborRoot);
  if (!existsSync(collectionsPath)) {
    return documents;
  }

  for (const entry of readdirSync(collectionsPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const collectionUuid = parseCollectionDirName(entry.name);
    if (!collectionUuid || !existsSync(join(collectionsPath, entry.name, 'collection.json'))) {
      continue;
    }

    const collectionDirPath = join(collectionsPath, entry.name);
    for (const row of readDocumentMetadataFromCollectionDir(collectionDirPath)) {
      const fileName = documentFileName(row.name);
      const filePath = resolveDocumentContentPath(harborRoot, row) ?? join(harborRoot, fileName);
      documents.push({
        uuid: row.uuid,
        collection_uuid: collectionUuid,
        name: row.name,
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
 * Parses a minimal YAML frontmatter block from markdown content.
 *
 * @param raw - Full markdown file contents.
 * @returns Parsed frontmatter fields and markdown body.
 */
export function parseMarkdownFrontmatter(raw: string): {
  frontmatter: StoredDocumentFrontmatter;
  body: string;
} {
  const trimmed = raw.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---')) {
    return {
      frontmatter: {
        uuid: generateDocumentUuid(),
        collection_uuid: '',
        name: '',
        folder_uuid: null,
        sort_order: 0
      },
      body: trimmed
    };
  }

  const end = trimmed.indexOf('\n---', 3);
  if (end < 0) {
    return {
      frontmatter: {
        uuid: generateDocumentUuid(),
        collection_uuid: '',
        name: '',
        folder_uuid: null,
        sort_order: 0
      },
      body: trimmed
    };
  }

  const yamlBlock = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 4).replace(/^\r?\n/, '');
  const frontmatter: StoredDocumentFrontmatter = {
    uuid: generateDocumentUuid(),
    collection_uuid: '',
    name: '',
    folder_uuid: null,
    sort_order: 0
  };

  for (const line of yamlBlock.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    const value = parseYamlScalar(rawValue);
    if (key === 'uuid' && value) {
      frontmatter.uuid = value;
      continue;
    }
    if (key === 'collection_uuid' && value) {
      frontmatter.collection_uuid = value;
      continue;
    }
    if (key === 'name' && value) {
      frontmatter.name = value;
      continue;
    }
    if (key === 'folder_uuid') {
      if (!value || value === 'null' || value === '~') {
        frontmatter.folder_uuid = null;
      } else {
        frontmatter.folder_uuid = value;
      }
      continue;
    }
    if (key === 'sort_order') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        frontmatter.sort_order = parsed;
      }
      continue;
    }
    if (key === 'color') {
      if (!value || value === 'null' || value === '~') {
        frontmatter.color = null;
      } else {
        frontmatter.color = value;
      }
    }
  }

  return { frontmatter, body };
}

/**
 * Maps stored document metadata and markdown body into an exported document row.
 *
 * @param row - Document metadata from collection.json.
 * @param body - Markdown body content.
 */
function exportedDocumentFromStoredRow(row: StoredDocumentRow, body: string): ExportedDocument {
  return {
    uuid: row.uuid,
    name: row.name,
    content: body,
    sort_order: row.sort_order,
    folder_uuid: row.folder_uuid ?? undefined,
    folder_name: null,
    color: row.color ?? null
  };
}

/**
 * Reads markdown document export rows from collection.json metadata and harbor-root files.
 *
 * @param harborRoot - HarborClient data root.
 * @param collectionUuid - Stable collection uuid.
 */
export function readDocumentsFromHarborRoot(
  harborRoot: string,
  collectionUuid: string
): ExportedDocument[] {
  const normalizedCollectionUuid = resolveImportUuid(collectionUuid);
  const collectionDirPath = findCollectionDirByUuid(harborRoot, normalizedCollectionUuid);
  if (!collectionDirPath) {
    return [];
  }

  const documents: ExportedDocument[] = [];
  for (const row of readDocumentMetadataFromCollectionDir(collectionDirPath)) {
    const filePath = resolveDocumentContentPath(harborRoot, row);
    let body = '';
    if (filePath && existsSync(filePath)) {
      body = readMarkdownDocumentBody(readFileSync(filePath, 'utf-8'));
    }
    documents.push(exportedDocumentFromStoredRow(row, body));
  }

  return documents.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * Reads legacy markdown documents from a collection `documents/` directory.
 *
 * @param collectionDirectory - Absolute path to the collection directory.
 */
function readLegacyDocumentsFromDir(collectionDirectory: string): ExportedDocument[] {
  const dir = legacyDocumentsDir(collectionDirectory);
  if (!existsSync(dir)) {
    return [];
  }

  const documents: ExportedDocument[] = [];
  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith('.md')) {
      continue;
    }
    const filePath = join(dir, fileName);
    const raw = readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseMarkdownFrontmatter(raw);
    documents.push(
      exportedDocumentFromStoredRow(
        {
          uuid: resolveImportUuid(frontmatter.uuid),
          name: frontmatter.name.trim() || fileName,
          folder_uuid: frontmatter.folder_uuid ?? null,
          sort_order: frontmatter.sort_order,
          color: frontmatter.color ?? null
        },
        body
      )
    );
  }

  return documents.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * Updates document metadata rows in one collection.json file.
 *
 * @param collectionDirectory - Absolute path to the collection directory.
 * @param documents - Document metadata rows to persist.
 */
function writeDocumentMetadataToCollectionDir(
  collectionDirectory: string,
  documents: StoredDocumentRow[]
): void {
  const manifestPath = join(collectionDirectory, 'collection.json');
  const raw = readJsonFile(manifestPath) as Record<string, unknown>;
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        ...raw,
        documents
      },
      null,
      2
    ),
    'utf-8'
  );
}

/**
 * Migrates legacy YAML frontmatter in harbor-root markdown files into collection.json.
 *
 * @param harborRoot - HarborClient data root.
 * @throws When migration would create a duplicate filename.
 */
export function migrateFrontmatterHarborDocuments(harborRoot: string): void {
  if (!existsSync(harborRoot)) {
    return;
  }

  for (const fileName of readdirSync(harborRoot)) {
    if (!fileName.endsWith('.md') || HARBOR_ROOT_RESERVED_NAMES.has(fileName)) {
      continue;
    }

    const filePath = join(harborRoot, fileName);
    const raw = readFileSync(filePath, 'utf-8');
    if (!hasMarkdownFrontmatter(raw)) {
      continue;
    }

    const { frontmatter, body } = parseMarkdownFrontmatter(raw);
    const uuid = resolveImportUuid(frontmatter.uuid);
    const collectionUuid = resolveImportUuid(frontmatter.collection_uuid);
    if (!uuid || !collectionUuid) {
      continue;
    }

    const collectionDirPath = findCollectionDirByUuid(harborRoot, collectionUuid);
    if (!collectionDirPath) {
      continue;
    }

    const displayName = frontmatter.name.trim() || fileName;
    const targetFileName = documentFileName(displayName);
    assertDocumentFilenameAvailable(harborRoot, displayName, uuid);

    const existingRows = readDocumentMetadataFromCollectionDir(collectionDirPath);
    const row: StoredDocumentRow = {
      uuid,
      name: displayName,
      folder_uuid: frontmatter.folder_uuid ?? null,
      sort_order: frontmatter.sort_order,
      color: frontmatter.color ?? null
    };
    const nextRows = existingRows.some((entry) => entry.uuid === uuid)
      ? existingRows.map((entry) => (entry.uuid === uuid ? row : entry))
      : [...existingRows, row];
    writeDocumentMetadataToCollectionDir(collectionDirPath, nextRows);

    const targetPath = join(harborRoot, targetFileName);
    writeFileSync(targetPath, body.trimStart(), 'utf-8');
    if (targetPath !== filePath) {
      rmSync(filePath, { force: true });
    }
  }
}

/**
 * Renames legacy UUID-prefixed harbor-root markdown files to case-preserving names.
 *
 * @param harborRoot - HarborClient data root.
 * @throws When migration would create a duplicate filename.
 */
export function migrateUuidPrefixedHarborDocuments(harborRoot: string): void {
  if (!existsSync(harborRoot)) {
    return;
  }

  for (const entry of listManagedHarborRootDocuments(harborRoot)) {
    const targetFileName = documentFileName(entry.name);
    if (entry.fileName === targetFileName) {
      continue;
    }

    assertDocumentFilenameAvailable(harborRoot, entry.name, entry.uuid);
    const targetPath = join(harborRoot, targetFileName);
    renameSync(entry.filePath, targetPath);

    const collectionDirPath = findCollectionDirByUuid(harborRoot, entry.collection_uuid);
    if (collectionDirPath) {
      const rows = readDocumentMetadataFromCollectionDir(collectionDirPath).map((row) =>
        row.uuid === entry.uuid ? { ...row, name: entry.name } : row
      );
      writeDocumentMetadataToCollectionDir(collectionDirPath, rows);
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
  migrateFrontmatterHarborDocuments(harborRoot);
  migrateUuidPrefixedHarborDocuments(harborRoot);

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
 * Migrates legacy collection `documents/*.md` files to the Harbor data root.
 *
 * @param collectionDirectory - Absolute path to the collection directory.
 * @param collectionUuid - Stable collection uuid.
 * @param harborRoot - HarborClient data root.
 */
export function migrateLegacyDocumentsFromCollectionDir(
  collectionDirectory: string,
  collectionUuid: string,
  harborRoot: string
): void {
  const legacyDocuments = readLegacyDocumentsFromDir(collectionDirectory);
  if (legacyDocuments.length === 0) {
    return;
  }

  const normalizedCollectionUuid = resolveImportUuid(collectionUuid);
  const existing = readDocumentsFromHarborRoot(harborRoot, normalizedCollectionUuid);
  const existingUuids = new Set(existing.map((document) => resolveImportUuid(document.uuid)));
  const merged = [
    ...existing,
    ...legacyDocuments.filter((document) => !existingUuids.has(resolveImportUuid(document.uuid)))
  ];

  const collectionDirPath = collectionDirectory;
  writeDocumentMetadataToCollectionDir(collectionDirPath, merged.map(exportedDocumentToStoredRow));
  writeDocumentsToHarborRoot(harborRoot, normalizedCollectionUuid, merged);

  const legacyDir = legacyDocumentsDir(collectionDirectory);
  if (existsSync(legacyDir)) {
    for (const fileName of readdirSync(legacyDir)) {
      if (fileName.endsWith('.md')) {
        rmSync(join(legacyDir, fileName), { force: true });
      }
    }
    try {
      rmSync(legacyDir, { recursive: true, force: true });
    } catch {
      // Directory may not be empty if non-markdown files exist.
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
   * Optional sidebar color for visual grouping.
   */
  color?: string | null;

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
   * Markdown document metadata; content files live at the Harbor data root.
   */
  documents?: StoredDocumentRow[];

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
  const trimmed = subdir.trim();
  if (!trimmed || trimmed === '.') {
    return repoPath;
  }
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
 * Returns the snippets directory path under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function snippetsDir(root: string): string {
  return join(root, 'snippets');
}

/**
 * Ensures the HarborClient directory layout exists and writes a default .gitignore.
 *
 * @param root - HarborClient data root.
 */
export function ensureHarborclientLayout(root: string): void {
  mkdirSync(collectionsDir(root), { recursive: true });
  mkdirSync(environmentsDir(root), { recursive: true });
  mkdirSync(snippetsDir(root), { recursive: true });
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
 * Normalizes a git on-disk request JSON payload before export validation.
 *
 * Git storage persists script reference arrays as JSON strings in request files;
 * import validation expects parsed arrays.
 *
 * @param parsed - Raw request JSON read from disk.
 */
function normalizeStoredRequestForValidation(
  parsed: Record<string, unknown>
): Record<string, unknown> {
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
 * Determines whether a newly parsed duplicate request file should replace the
 * one already chosen for the same UUID.
 *
 * Legacy repositories can accumulate several `{uuid}-{slug}.json` files for a
 * single request UUID (for example after renames that left orphan slug files
 * behind). When collapsing those duplicates we prefer the candidate that most
 * likely holds the live data: one with a non-empty URL wins over an empty
 * placeholder, and otherwise the most recently modified file wins.
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
 * Reads collection manifest and request files from a collection directory.
 *
 * Duplicate slug files for the same request UUID are collapsed to a single row
 * (see {@link isBetterRequestCandidate}) so callers never observe stale
 * duplicate request rows from legacy orphan files.
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
    color:
      raw.color == null ? null : typeof raw.color === 'string' ? raw.color.trim() || null : null,
    variables: (raw.variables as CollectionManifest['variables']) ?? [],
    headers: (raw.headers as CollectionManifest['headers']) ?? [],
    auth: raw.auth as CollectionManifest['auth'],
    pre_request_script: String(raw.pre_request_script ?? ''),
    post_request_script: String(raw.post_request_script ?? ''),
    folders: ((raw.folders as StoredFolderRow[]) ?? []).map((folder, index) => ({
      uuid: resolveImportUuid(folder.uuid),
      name: String(folder.name ?? '').trim(),
      sort_order: folder.sort_order ?? index,
      variables: folder.variables ?? [],
      headers: folder.headers ?? [],
      auth: folder.auth ?? defaultAuth(),
      pre_request_script: folder.pre_request_script ?? '',
      post_request_script: folder.post_request_script ?? '',
      pre_request_scripts: folder.pre_request_scripts ?? [],
      post_request_scripts: folder.post_request_scripts ?? [],
      color:
        folder.color == null
          ? null
          : typeof folder.color === 'string'
            ? folder.color.trim() || null
            : null
    })),
    documents: parseStoredDocumentRows(raw.documents),
    created_at: String(raw.created_at ?? new Date().toISOString())
  };

  const requestsDir = join(dir, 'requests');
  const requests: ExportedRequest[] = [];
  if (existsSync(requestsDir)) {
    const bestByUuid = new Map<
      string,
      { row: ExportedRequest; hasUrl: boolean; mtimeMs: number }
    >();
    const orderedKeys: string[] = [];

    for (const fileName of readdirSync(requestsDir)) {
      if (!fileName.endsWith('.json')) {
        continue;
      }
      const requestPath = join(requestsDir, fileName);
      const parsed = readJsonFile(requestPath) as Record<string, unknown>;
      const validated = validateRequestExport(normalizeStoredRequestForValidation(parsed));
      const row: ExportedRequest = {
        ...validated,
        uuid: validated.uuid,
        sort_order:
          typeof (parsed as { sort_order?: number }).sort_order === 'number'
            ? (parsed as { sort_order: number }).sort_order
            : bestByUuid.size,
        folder_name:
          typeof (parsed as { folder_name?: string | null }).folder_name === 'string'
            ? (parsed as { folder_name: string }).folder_name
            : null,
        folder_uuid:
          typeof (parsed as { folder_uuid?: string }).folder_uuid === 'string'
            ? (parsed as { folder_uuid: string }).folder_uuid
            : undefined
      };

      const key = parseRequestFileName(fileName) ?? `__nouuid__:${fileName}`;
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(requestPath).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      const candidate = { row, hasUrl: (row.url ?? '').trim().length > 0, mtimeMs };
      const current = bestByUuid.get(key);
      if (current == null) {
        bestByUuid.set(key, candidate);
        orderedKeys.push(key);
      } else if (isBetterRequestCandidate(candidate, current)) {
        bestByUuid.set(key, candidate);
      }
    }

    for (const key of orderedKeys) {
      requests.push(bestByUuid.get(key)!.row);
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
  const existingUuidToPaths = new Map<string, string[]>();

  if (existsSync(requestsPath)) {
    for (const fileName of readdirSync(requestsPath)) {
      if (!fileName.endsWith('.json')) {
        continue;
      }
      const uuid = parseRequestFileName(fileName);
      if (uuid) {
        const paths = existingUuidToPaths.get(uuid) ?? [];
        paths.push(join(requestsPath, fileName));
        existingUuidToPaths.set(uuid, paths);
      }
    }
  }

  // #region agent log
  try {
    fetch('http://127.0.0.1:7634/ingest/c3368b90-dc8c-409b-b6ba-5e08697b30c9', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '384f61' },
      body: JSON.stringify({
        sessionId: '384f61',
        runId: 'pre-fix',
        hypothesisId: 'A,B,E',
        location: 'fileLayout.ts:writeCollectionToDir:entry',
        message: 'writeCollectionToDir existing files + incoming requests',
        data: {
          dir,
          existingFiles: existsSync(requestsPath) ? readdirSync(requestsPath) : [],
          incoming: requests.map((r) => ({ uuid: resolveImportUuid(r.uuid), name: r.name }))
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
  } catch {
    /* noop */
  }
  // #endregion

  for (const request of requests) {
    const uuid = resolveImportUuid(request.uuid);
    if (writtenUuids.has(uuid)) {
      continue;
    }
    writtenUuids.add(uuid);
    const fileName = `${uuidSlugPrefix(uuid, request.name)}.json`;
    const targetPath = join(requestsPath, fileName);
    const payload = exportedRequestToRequestExport(request);
    writeFileSync(
      targetPath,
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

    for (const previousPath of existingUuidToPaths.get(uuid) ?? []) {
      if (previousPath !== targetPath) {
        rmSync(previousPath, { force: true });
      }
    }
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

  // #region agent log
  try {
    fetch('http://127.0.0.1:7634/ingest/c3368b90-dc8c-409b-b6ba-5e08697b30c9', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '384f61' },
      body: JSON.stringify({
        sessionId: '384f61',
        runId: 'pre-fix',
        hypothesisId: 'A,B,E',
        location: 'fileLayout.ts:writeCollectionToDir:end',
        message: 'writeCollectionToDir final files on disk',
        data: {
          dir,
          finalFiles: existsSync(requestsPath) ? readdirSync(requestsPath) : [],
          writtenUuids: [...writtenUuids]
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
  } catch {
    /* noop */
  }
  // #endregion
}

/**
 * Converts manifest + requests into a validated CollectionExport payload.
 *
 * @param manifest - Stored collection manifest.
 * @param requests - Request export rows.
 * @param documents - Markdown document export rows.
 */
export function manifestToCollectionExport(
  manifest: CollectionManifest & {
    pre_request_scripts?: string;
    post_request_scripts?: string;
  },
  requests: ExportedRequest[],
  documents: ExportedDocument[] = []
): CollectionExport {
  const folders: ExportedFolder[] = manifest.folders.map((folder) => ({
    uuid: folder.uuid,
    name: folder.name,
    sort_order: folder.sort_order,
    variables: maskVariablesForExport(folder.variables ?? []),
    headers: folder.headers ?? [],
    auth: folder.auth ?? defaultAuth(),
    pre_request_script: folder.pre_request_script ?? '',
    post_request_script: folder.post_request_script ?? '',
    pre_request_scripts: folder.pre_request_scripts ?? [],
    post_request_scripts: folder.post_request_scripts ?? [],
    color: folder.color ?? null
  }));

  return validateCollectionExport({
    harborclientVersion: 1,
    harborclientExport: 'collection',
    uuid: manifest.uuid,
    name: manifest.name,
    color: manifest.color ?? null,
    variables: manifest.variables,
    headers: manifest.headers,
    auth: manifest.auth,
    pre_request_script: manifest.pre_request_script,
    post_request_script: manifest.post_request_script,
    pre_request_scripts: readScriptRefsFromJson(
      manifest.pre_request_scripts,
      manifest.pre_request_script
    ),
    post_request_scripts: readScriptRefsFromJson(
      manifest.post_request_scripts,
      manifest.post_request_script
    ),
    folders,
    requests,
    documents
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
 * Writes a snippet export file.
 *
 * @param root - HarborClient data root.
 * @param data - Snippet export payload.
 */
export function writeSnippetFile(root: string, data: SnippetExport): void {
  const dir = snippetsDir(root);
  mkdirSync(dir, { recursive: true });
  const uuid = resolveImportUuid(data.uuid);
  const fileName = `${uuidSlugPrefix(uuid, data.name)}.json`;
  writeFileSync(join(dir, fileName), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Reads all snippet export files under a HarborClient root.
 *
 * @param root - HarborClient data root.
 */
export function readAllSnippets(root: string): SnippetExport[] {
  const dir = snippetsDir(root);
  if (!existsSync(dir)) {
    return [];
  }

  const snippets: SnippetExport[] = [];
  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const snippetPath = join(dir, fileName);
    const parsed = readJsonFile(snippetPath);
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
  const dir = snippetsDir(root);
  if (!existsSync(dir)) {
    return;
  }

  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const snippetPath = join(dir, fileName);
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
    pre_request_scripts: request.pre_request_scripts,
    post_request_scripts: request.post_request_scripts,
    comment: request.comment,
    tags: request.tags,
    color: request.color ?? null
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
