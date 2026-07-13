import * as git from 'isomorphic-git';
import fs, { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import {
  buildFilenameToDocumentMap,
  documentFileName,
  isHarborDocumentPath,
  parseCollectionDirName,
  parseMarkdownFrontmatter,
  parseRequestFileName,
  parseStoredDocumentRows,
  resolveHarborclientRoot
} from '#/main/git/fileLayout';
import { uuidSlugPrefix } from '#/main/git/slug';
import { resolveImportUuid } from '#/main/storage/uuid';
import type { GitRequestDisplayStatus, GitRequestFileStatus } from '#/shared/types';

/**
 * One isomorphic-git statusMatrix row: filepath, HEAD, workdir, stage.
 */
export type GitMatrixRow = [string, number, number, number];

/**
 * Per-file git change flags derived from a statusMatrix row.
 */
export interface GitRequestRowFlags {
  /**
   * Whether the index differs from HEAD (staged for commit).
   */
  hasStagedChanges: boolean;

  /**
   * Whether the working tree differs from the index.
   */
  hasUnstagedChanges: boolean;

  /**
   * Whether the file is new and not yet tracked in HEAD.
   */
  isUntracked: boolean;
}

/**
 * Document identity resolved from collection.json metadata and filename.
 */
export interface DocumentGitIdentity {
  /**
   * Stable document uuid from collection.json.
   */
  uuid: string;

  /**
   * Stable collection uuid owning the document.
   */
  collection_uuid: string;
}

/**
 * Returns change flags for one matrix row, or null when the row is clean.
 *
 * @param row - statusMatrix row from isomorphic-git.
 */
export function analyzeMatrixRow(row: GitMatrixRow): GitRequestRowFlags | null {
  const [, head, workdir, stage] = row;
  if (head === workdir && workdir === stage) {
    return null;
  }

  const isUntracked = head === 0 && workdir !== 0 && stage === 0;
  const hasStagedChanges =
    stage === 2 || (head !== 0 && stage === 0) || (head === 0 && stage !== 0);
  const hasUnstagedChanges =
    isUntracked || (workdir === 2 && stage !== 2) || (head !== 0 && workdir === 0 && stage !== 0);

  return {
    hasStagedChanges,
    hasUnstagedChanges,
    isUntracked
  };
}

/**
 * Derives sidebar display status and menu visibility from per-file flags.
 *
 * Unstaged working-tree edits take precedence over staged-only state.
 *
 * @param flagsList - Change flags for all paths belonging to one request.
 */
export function deriveRequestStatus(flagsList: GitRequestRowFlags[]): GitRequestFileStatus {
  if (flagsList.length === 0) {
    return { displayStatus: 'clean', canAdd: false, canRemove: false };
  }

  const hasStagedChanges = flagsList.some((flags) => flags.hasStagedChanges);
  const hasUnstagedChanges = flagsList.some((flags) => flags.hasUnstagedChanges);
  const isUntracked = flagsList.some((flags) => flags.isUntracked);

  let displayStatus: GitRequestDisplayStatus = 'clean';
  if (isUntracked || hasUnstagedChanges) {
    displayStatus = isUntracked ? 'unstaged' : 'uncommitted';
  } else if (hasStagedChanges) {
    displayStatus = 'staged';
  }

  return {
    displayStatus,
    canAdd: hasUnstagedChanges || isUntracked,
    canRemove: hasStagedChanges
  };
}

/**
 * Returns true when a repository-relative path is a request JSON file for a collection.
 *
 * @param filepath - Repository-relative path.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 */
export function isRequestPathForCollection(
  filepath: string,
  harborSubdir: string,
  collectionUuid: string
): boolean {
  const normalized = filepath.replace(/\\/g, '/');
  const prefix = harborSubdir === '.' ? 'collections/' : `${harborSubdir}/collections/`;
  if (!normalized.startsWith(prefix)) {
    return false;
  }

  const remainder = normalized.slice(prefix.length);
  const slashIndex = remainder.indexOf('/');
  if (slashIndex < 0) {
    return false;
  }

  const collectionDirName = remainder.slice(0, slashIndex);
  const collectionDirUuid = parseCollectionDirName(collectionDirName);
  if (collectionDirUuid?.toLowerCase() !== collectionUuid.toLowerCase()) {
    return false;
  }

  const afterCollection = remainder.slice(slashIndex + 1);
  return afterCollection.startsWith('requests/') && afterCollection.endsWith('.json');
}

/**
 * Parses a collection uuid from a repository-relative collections path.
 *
 * @param filepath - Repository-relative path.
 * @param harborSubdir - HarborClient subdirectory prefix.
 */
export function parseCollectionUuidFromPath(filepath: string, harborSubdir: string): string | null {
  const normalized = filepath.replace(/\\/g, '/');
  const prefix = harborSubdir === '.' ? 'collections/' : `${harborSubdir}/collections/`;
  if (!normalized.startsWith(prefix)) {
    return null;
  }

  const remainder = normalized.slice(prefix.length);
  const slashIndex = remainder.indexOf('/');
  if (slashIndex < 0) {
    return null;
  }

  return parseCollectionDirName(remainder.slice(0, slashIndex));
}

/**
 * Parses a request uuid from a repository-relative request JSON path.
 *
 * @param filepath - Repository-relative path under `collections/.../requests/`.
 */
export function parseRequestUuidFromPath(filepath: string): string | null {
  const normalized = filepath.replace(/\\/g, '/');
  const requestsIndex = normalized.lastIndexOf('/requests/');
  if (requestsIndex < 0) {
    return null;
  }

  const fileName = normalized.slice(requestsIndex + '/requests/'.length);
  return parseRequestFileName(fileName);
}

/**
 * Collects statusMatrix rows for request files in one collection.
 *
 * @param matrix - Full or filtered statusMatrix rows.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 */
export function collectRequestRowsForCollection(
  matrix: GitMatrixRow[],
  harborSubdir: string,
  collectionUuid: string
): Map<string, GitMatrixRow[]> {
  const byRequestUuid = new Map<string, GitMatrixRow[]>();

  for (const row of matrix) {
    const filepath = row[0];
    if (!isRequestPathForCollection(filepath, harborSubdir, collectionUuid)) {
      continue;
    }

    const requestUuid = parseRequestUuidFromPath(filepath);
    if (requestUuid == null) {
      continue;
    }

    const existing = byRequestUuid.get(requestUuid) ?? [];
    existing.push(row);
    byRequestUuid.set(requestUuid, existing);
  }

  return byRequestUuid;
}

/**
 * Builds per-request git status for one collection from a status matrix.
 *
 * @param matrix - statusMatrix rows scoped to the HarborClient tree.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 */
export function buildRequestStatusesForCollection(
  matrix: GitMatrixRow[],
  harborSubdir: string,
  collectionUuid: string
): Record<string, GitRequestFileStatus> {
  const rowsByUuid = collectRequestRowsForCollection(matrix, harborSubdir, collectionUuid);
  const statuses: Record<string, GitRequestFileStatus> = {};

  for (const [requestUuid, rows] of rowsByUuid) {
    const flagsList = rows
      .map((row) => analyzeMatrixRow(row))
      .filter((flags): flags is GitRequestRowFlags => flags != null);
    statuses[requestUuid] = deriveRequestStatus(flagsList);
  }

  return statuses;
}

/**
 * Counts staged and unstaged changes from a HarborClient status matrix.
 *
 * @param matrix - statusMatrix rows scoped to the HarborClient tree.
 */
export function countStagedAndUnstaged(matrix: GitMatrixRow[]): {
  stagedCount: number;
  unstagedCount: number;
  changedCount: number;
} {
  let stagedCount = 0;
  let unstagedCount = 0;
  let changedCount = 0;

  for (const row of matrix) {
    const flags = analyzeMatrixRow(row);
    if (flags == null) {
      continue;
    }

    changedCount += 1;
    if (flags.hasStagedChanges) {
      stagedCount += 1;
    }
    if (flags.hasUnstagedChanges || flags.isUntracked) {
      unstagedCount += 1;
    }
  }

  return { stagedCount, unstagedCount, changedCount };
}

/**
 * Returns true when any file under the HarborClient tree is staged for commit.
 *
 * @param matrix - statusMatrix rows scoped to the HarborClient tree.
 */
export function hasStagedChanges(matrix: GitMatrixRow[]): boolean {
  return matrix.some((row) => {
    const flags = analyzeMatrixRow(row);
    return flags?.hasStagedChanges === true;
  });
}

/**
 * Loads the HarborClient status matrix for a repository subdirectory.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory relative to the repo root.
 */
export async function loadHarborStatusMatrix(
  repoPath: string,
  harborSubdir: string
): Promise<GitMatrixRow[]> {
  return git.statusMatrix({
    fs,
    dir: repoPath,
    filepaths: [harborSubdir]
  }) as Promise<GitMatrixRow[]>;
}

/**
 * Returns matrix rows for all paths belonging to one request uuid in a collection.
 *
 * @param matrix - HarborClient status matrix.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 * @param requestUuid - Stable request uuid.
 */
export function requestRowsForUuid(
  matrix: GitMatrixRow[],
  harborSubdir: string,
  collectionUuid: string,
  requestUuid: string
): GitMatrixRow[] {
  return (
    collectRequestRowsForCollection(matrix, harborSubdir, collectionUuid).get(requestUuid) ?? []
  );
}

/**
 * HEAD and working-tree paths for one request diff, ignoring stale duplicate files.
 */
export interface ResolvedResourceDiffPaths {
  /**
   * Repository-relative path at HEAD, or null when the request is newly added.
   */
  headPath: string | null;

  /**
   * Repository-relative path in the working tree, or null when deleted.
   */
  workPath: string | null;
}

/**
 * Resolves canonical HEAD and working-tree paths for one request diff.
 *
 * Prefers the file named `{uuid}-{slug(requestName)}.json` in the working tree,
 * falling back to the first non-deleted UUID match. HEAD uses any committed path
 * for the same UUID (rename-aware).
 *
 * @param rows - statusMatrix rows for the request uuid.
 * @param requestUuid - Stable request uuid.
 * @param requestName - Current display name used for the canonical slug.
 */
export function resolveRequestDiffPaths(
  rows: GitMatrixRow[],
  requestUuid: string,
  requestName: string
): ResolvedResourceDiffPaths {
  const canonicalFileName = `${uuidSlugPrefix(requestUuid, requestName)}.json`;

  let headPath: string | null = null;
  let workPath: string | null = null;
  let fallbackWorkPath: string | null = null;

  for (const row of rows) {
    const filepath = row[0];
    const [, head, workdir] = row;
    const fileName = basename(filepath);

    if (head !== 0) {
      headPath = filepath;
    }

    if (workdir !== 0) {
      if (fileName === canonicalFileName) {
        workPath = filepath;
      } else if (fallbackWorkPath == null) {
        fallbackWorkPath = filepath;
      }
    }
  }

  return {
    headPath,
    workPath: workPath ?? fallbackWorkPath
  };
}

/**
 * Resolves canonical HEAD and working-tree paths for one markdown document diff.
 *
 * @param rows - statusMatrix rows for the document uuid.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param documentName - Current display name used for the canonical file name.
 */
export function resolveDocumentDiffPaths(
  rows: GitMatrixRow[],
  harborSubdir: string,
  documentName: string
): ResolvedResourceDiffPaths {
  const canonicalBaseName = documentFileName(documentName);
  const prefix = harborSubdir === '.' ? '' : `${harborSubdir}/`;
  const canonicalPath = `${prefix}${canonicalBaseName}`;

  let headPath: string | null = null;
  let workPath: string | null = null;
  let fallbackWorkPath: string | null = null;

  for (const row of rows) {
    const filepath = row[0];
    const [, head, workdir] = row;

    if (head !== 0) {
      headPath = filepath;
    }

    if (workdir !== 0) {
      if (filepath === canonicalPath) {
        workPath = filepath;
      } else if (fallbackWorkPath == null) {
        fallbackWorkPath = filepath;
      }
    }
  }

  return {
    headPath,
    workPath: workPath ?? fallbackWorkPath
  };
}

/**
 * Parses document identity from legacy markdown frontmatter text.
 *
 * @param raw - Full markdown file contents.
 */
function parseLegacyDocumentIdentityFromRaw(raw: string): DocumentGitIdentity | null {
  const { frontmatter } = parseMarkdownFrontmatter(raw);
  const uuid = resolveImportUuid(frontmatter.uuid);
  const collectionUuid = resolveImportUuid(frontmatter.collection_uuid);
  if (!uuid || !collectionUuid) {
    return null;
  }

  return { uuid, collection_uuid: collectionUuid };
}

/**
 * Resolves document identity from collection.json metadata on disk.
 *
 * @param harborRoot - HarborClient data root.
 * @param fileName - Markdown file name at the Harbor root.
 */
function resolveDocumentIdentityFromWorkdir(
  harborRoot: string,
  fileName: string
): DocumentGitIdentity | null {
  const entry = buildFilenameToDocumentMap(harborRoot).get(fileName.toLowerCase());
  if (entry == null) {
    return null;
  }

  return {
    uuid: entry.uuid,
    collection_uuid: entry.collection_uuid
  };
}

/**
 * Reads one collection.json blob from a git tree.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative collection.json path.
 * @param tree - Git tree source.
 */
async function readCollectionJsonFromGitTree(
  repoPath: string,
  filepath: string,
  tree: 'STAGE' | 'HEAD'
): Promise<Record<string, unknown> | null> {
  let content: Uint8Array | null = null;

  try {
    await git.walk({
      fs,
      dir: repoPath,
      trees: [tree === 'STAGE' ? git.STAGE() : git.TREE({ ref: 'HEAD' })],
      /**
       * Captures collection.json blob content when the walked path matches.
       *
       * @param path - Repository-relative path from the walker.
       * @param trees - Tuple of tree entries for the requested ref.
       */
      map: async (path, [entry]) => {
        if (path !== filepath || entry == null) {
          return;
        }
        const type = await entry.type();
        if (type === 'blob') {
          const blob = await entry.content();
          if (blob instanceof Uint8Array) {
            content = blob;
          }
        }
      }
    });
  } catch {
    return null;
  }

  if (content == null) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(content).toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Lists repository-relative collection.json paths from a git tree.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param tree - Git tree source.
 */
async function listCollectionManifestPathsFromGitTree(
  repoPath: string,
  harborSubdir: string,
  tree: 'STAGE' | 'HEAD'
): Promise<string[]> {
  const prefix = harborSubdir === '.' ? 'collections/' : `${harborSubdir}/collections/`;
  const paths: string[] = [];

  try {
    await git.walk({
      fs,
      dir: repoPath,
      trees: [tree === 'STAGE' ? git.STAGE() : git.TREE({ ref: 'HEAD' })],
      /**
       * Collects collection.json blob paths under the Harbor collections directory.
       *
       * @param path - Repository-relative path from the walker.
       * @param trees - Tuple of tree entries for the requested ref.
       */
      map: async (path, [entry]) => {
        const normalized = path.replace(/\\/g, '/');
        if (
          !normalized.startsWith(prefix) ||
          !normalized.endsWith('/collection.json') ||
          entry == null
        ) {
          return;
        }
        const type = await entry.type();
        if (type === 'blob') {
          paths.push(normalized);
        }
      }
    });
  } catch {
    return [];
  }

  return paths;
}

/**
 * Resolves document identity from collection.json metadata in git stage or HEAD.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param fileName - Markdown file name at the Harbor root.
 * @param tree - Git tree source.
 */
async function resolveDocumentIdentityFromGitTree(
  repoPath: string,
  harborSubdir: string,
  fileName: string,
  tree: 'STAGE' | 'HEAD'
): Promise<DocumentGitIdentity | null> {
  const prefix = harborSubdir === '.' ? 'collections/' : `${harborSubdir}/collections/`;
  const manifestPaths = await listCollectionManifestPathsFromGitTree(repoPath, harborSubdir, tree);
  const normalizedFileName = fileName.toLowerCase();

  for (const filepath of manifestPaths) {
    const normalized = filepath.replace(/\\/g, '/');
    const collectionDirName = normalized.slice(prefix.length, -'/collection.json'.length);
    const collectionUuid = parseCollectionDirName(collectionDirName);
    if (!collectionUuid) {
      continue;
    }

    const raw = await readCollectionJsonFromGitTree(repoPath, normalized, tree);
    if (raw == null) {
      continue;
    }

    for (const row of parseStoredDocumentRows(raw.documents)) {
      if (
        row.name.toLowerCase() === normalizedFileName ||
        basename(row.name).toLowerCase() === normalizedFileName
      ) {
        return {
          uuid: row.uuid,
          collection_uuid: collectionUuid
        };
      }
    }
  }

  return null;
}

/**
 * Reads a working-tree markdown file for a repository-relative path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative path.
 */
function readWorkdirMarkdown(repoPath: string, filepath: string): string | null {
  const fullPath = join(repoPath, filepath);
  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    return readFileSync(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Resolves document identity from collection.json and filename, with legacy frontmatter fallback.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param row - statusMatrix row for one harbor-root markdown file.
 */
export async function readDocumentIdentityFromMatrixRow(
  repoPath: string,
  harborSubdir: string,
  row: GitMatrixRow
): Promise<DocumentGitIdentity | null> {
  const [filepath, head, , stage] = row;
  const fileName = basename(filepath.replace(/\\/g, '/'));
  const harborRoot = resolveHarborclientRoot(repoPath, harborSubdir);

  const workdirIdentity = resolveDocumentIdentityFromWorkdir(harborRoot, fileName);
  if (workdirIdentity != null) {
    return workdirIdentity;
  }

  if (stage !== 0) {
    const stageIdentity = await resolveDocumentIdentityFromGitTree(
      repoPath,
      harborSubdir,
      fileName,
      'STAGE'
    );
    if (stageIdentity != null) {
      return stageIdentity;
    }
  }

  if (head !== 0) {
    const headIdentity = await resolveDocumentIdentityFromGitTree(
      repoPath,
      harborSubdir,
      fileName,
      'HEAD'
    );
    if (headIdentity != null) {
      return headIdentity;
    }
  }

  const workdirRaw = readWorkdirMarkdown(repoPath, filepath);
  if (workdirRaw != null) {
    const legacyIdentity = parseLegacyDocumentIdentityFromRaw(workdirRaw);
    if (legacyIdentity != null) {
      return legacyIdentity;
    }
  }

  return null;
}

/**
 * Collects statusMatrix rows for harbor-root markdown documents in one collection.
 *
 * @param matrix - Full or filtered statusMatrix rows.
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 */
export async function collectDocumentRowsForCollection(
  matrix: GitMatrixRow[],
  repoPath: string,
  harborSubdir: string,
  collectionUuid: string
): Promise<Map<string, GitMatrixRow[]>> {
  const byDocumentUuid = new Map<string, GitMatrixRow[]>();
  const normalizedCollectionUuid = collectionUuid.toLowerCase();

  for (const row of matrix) {
    const filepath = row[0];
    if (!isHarborDocumentPath(filepath, harborSubdir)) {
      continue;
    }

    const identity = await readDocumentIdentityFromMatrixRow(repoPath, harborSubdir, row);
    if (identity?.collection_uuid.toLowerCase() !== normalizedCollectionUuid) {
      continue;
    }

    const existing = byDocumentUuid.get(identity.uuid) ?? [];
    existing.push(row);
    byDocumentUuid.set(identity.uuid, existing);
  }

  return byDocumentUuid;
}

/**
 * Builds per-document git status for one collection from a status matrix.
 *
 * @param matrix - statusMatrix rows scoped to the HarborClient tree.
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 */
export async function buildDocumentStatusesForCollection(
  matrix: GitMatrixRow[],
  repoPath: string,
  harborSubdir: string,
  collectionUuid: string
): Promise<Record<string, GitRequestFileStatus>> {
  const rowsByUuid = await collectDocumentRowsForCollection(
    matrix,
    repoPath,
    harborSubdir,
    collectionUuid
  );
  const statuses: Record<string, GitRequestFileStatus> = {};

  for (const [documentUuid, rows] of rowsByUuid) {
    const flagsList = rows
      .map((row) => analyzeMatrixRow(row))
      .filter((flags): flags is GitRequestRowFlags => flags != null);
    statuses[documentUuid] = deriveRequestStatus(flagsList);
  }

  return statuses;
}

/**
 * Returns matrix rows for all paths belonging to one document uuid in a collection.
 *
 * @param matrix - HarborClient status matrix.
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 * @param documentUuid - Stable document uuid.
 */
export async function documentRowsForUuid(
  matrix: GitMatrixRow[],
  repoPath: string,
  harborSubdir: string,
  collectionUuid: string,
  documentUuid: string
): Promise<GitMatrixRow[]> {
  return (
    (await collectDocumentRowsForCollection(matrix, repoPath, harborSubdir, collectionUuid)).get(
      documentUuid
    ) ?? []
  );
}
