import * as git from 'isomorphic-git';
import fs from 'fs';
import { truncateTextForLlm } from '#/shared/ai/chatContext';
import {
  documentFileName,
  isHarborDocumentPath,
  parseCollectionDirName,
  parseMarkdownFrontmatter,
  parseStoredDocumentRows
} from '#/main/git/fileLayout';
import {
  isRequestPathForCollection,
  parseCollectionUuidFromPath,
  parseRequestUuidFromPath
} from '#/main/git/gitRequestStatus';
import { resolveImportUuid } from '#/main/storage/uuid';
import type {
  GitCommitChangeStatus,
  GitCommitDetail,
  GitCommitFileChange,
  GitGraphLogEntry,
  GitGraphLogResult,
  GitRequestDiffFileEntry,
  GitRequestDiffResult
} from '#/shared/types';

/**
 * Maximum characters per file in a commit resource diff excerpt.
 */
const COMMIT_DIFF_MAX_CHARS_PER_FILE = 12_000;

/**
 * Maximum total characters across all files in a commit resource diff.
 */
const COMMIT_DIFF_MAX_TOTAL_CHARS = 48_000;

/**
 * One raw path-level change before request/document grouping.
 */
interface RawCommitFileChange {
  /**
   * Repository-relative path under the HarborClient tree.
   */
  path: string;

  /**
   * Change type relative to the parent commit.
   */
  status: GitCommitChangeStatus;
}

/**
 * Metadata parsed from a request JSON blob at a specific commit revision.
 */
interface CommitRequestMetadata {
  /**
   * Stable request uuid.
   */
  uuid: string;

  /**
   * Stable collection uuid from the file path.
   */
  collectionUuid: string;

  /**
   * Request display name.
   */
  name: string;

  /**
   * HTTP method.
   */
  method: string;

  /**
   * Optional sidebar color.
   */
  color?: string | null;
}

/**
 * Metadata parsed from a markdown document blob at a specific commit revision.
 */
interface CommitDocumentMetadata {
  /**
   * Stable document uuid.
   */
  uuid: string;

  /**
   * Stable collection uuid from frontmatter.
   */
  collectionUuid: string;

  /**
   * Document display name.
   */
  name: string;

  /**
   * Optional sidebar color.
   */
  color?: string | null;
}

/**
 * Builds graph-ready git log entries with parent links for visualization.
 *
 * @param repoPath - Absolute repository root.
 * @param depth - Maximum number of commits to walk from HEAD.
 */
export async function buildGitGraphLog(repoPath: string, depth = 100): Promise<GitGraphLogResult> {
  const currentBranch = await readCurrentBranch(repoPath);
  let headCommitHash: string | null = null;

  try {
    headCommitHash = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
  } catch {
    headCommitHash = null;
  }

  const commits = await git.log({ fs, dir: repoPath, depth });
  const refByOid = await buildRefMap(repoPath);
  const branchLabel = currentBranch ?? 'HEAD';

  const entries: GitGraphLogEntry[] = commits.map((entry) => {
    const refs = refByOid.get(entry.oid) ?? [];
    const branch =
      refs.find((ref) => ref.startsWith('refs/heads/'))?.replace('refs/heads/', '') ??
      refs.find((ref) => ref.startsWith('refs/remotes/'))?.replace('refs/remotes/', '') ??
      branchLabel;

    return {
      hash: entry.oid,
      branch,
      parents: [...entry.commit.parent],
      message: entry.commit.message.split('\n')[0] ?? '',
      committerDate: new Date(entry.commit.committer.timestamp * 1000).toISOString(),
      author: {
        name: entry.commit.author.name,
        email: entry.commit.author.email
      }
    };
  });

  return {
    entries,
    currentBranch,
    headCommitHash
  };
}

/**
 * Returns commit metadata and HarborClient-scoped file changes for one commit.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id to inspect.
 */
export async function readGitCommitDetail(
  repoPath: string,
  harborSubdir: string,
  oid: string
): Promise<GitCommitDetail> {
  const { commit } = await git.readCommit({ fs, dir: repoPath, oid });
  const parentOid = commit.parent[0] ?? null;
  const rawChanges = await listRawCommitFileChanges(repoPath, harborSubdir, oid, parentOid);
  const files = await groupCommitFileChanges(repoPath, harborSubdir, oid, parentOid, rawChanges);

  return {
    oid,
    message: commit.message.split('\n')[0] ?? '',
    fullMessage: commit.message,
    author: commit.author.name,
    timestamp: new Date(commit.author.timestamp * 1000).toISOString(),
    parents: [...commit.parent],
    files
  };
}

/**
 * Builds a parent-to-commit diff for one request or document changed in a commit.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id.
 * @param collectionUuid - Stable collection uuid.
 * @param resourceUuid - Stable request or document uuid.
 * @param kind - Whether the resource is a request or markdown document.
 * @param resourceName - Display name shown in the diff modal title.
 */
export async function buildCommitResourceDiff(
  repoPath: string,
  harborSubdir: string,
  oid: string,
  collectionUuid: string,
  resourceUuid: string,
  kind: 'request' | 'document',
  resourceName: string
): Promise<GitRequestDiffResult> {
  const { commit } = await git.readCommit({ fs, dir: repoPath, oid });
  const parentOid = commit.parent[0] ?? null;
  const rawChanges = await listRawCommitFileChanges(repoPath, harborSubdir, oid, parentOid);
  const grouped = await groupCommitFileChanges(repoPath, harborSubdir, oid, parentOid, rawChanges);

  const resourceChange = grouped.find((entry) => {
    if (kind === 'request' && entry.kind === 'request') {
      return (
        entry.collectionUuid.toLowerCase() === collectionUuid.toLowerCase() &&
        entry.requestUuid.toLowerCase() === resourceUuid.toLowerCase()
      );
    }
    if (kind === 'document' && entry.kind === 'document') {
      return (
        entry.collectionUuid.toLowerCase() === collectionUuid.toLowerCase() &&
        entry.documentUuid.toLowerCase() === resourceUuid.toLowerCase()
      );
    }
    return false;
  });

  if (resourceChange == null || resourceChange.kind === 'file') {
    return {
      requestName: resourceName,
      files: [],
      error: 'This resource was not changed in the selected commit.'
    };
  }

  const files: GitRequestDiffFileEntry[] = [];
  let totalChars = 0;

  for (const path of resourceChange.paths) {
    const rawChange = rawChanges.find((change) => change.path === path);
    if (rawChange == null) {
      continue;
    }

    const entry = await buildCommitPathDiffEntry(repoPath, oid, parentOid, path, rawChange.status);
    if (entry == null) {
      continue;
    }

    if (entry.diff != null) {
      const remainingBudget = COMMIT_DIFF_MAX_TOTAL_CHARS - totalChars;
      if (remainingBudget <= 0) {
        entry.truncated = true;
        entry.diff = undefined;
      } else if (entry.diff.length > remainingBudget) {
        const capped = truncateTextForLlm(entry.diff, remainingBudget);
        entry.diff = capped.text;
        entry.truncated = capped.truncated;
        totalChars += capped.text.length;
      } else {
        totalChars += entry.diff.length;
      }
    }

    files.push(entry);
  }

  return {
    requestName: resourceName,
    files
  };
}

/**
 * Reads the current branch name when the repository is on a branch.
 *
 * @param repoPath - Absolute repository root.
 */
async function readCurrentBranch(repoPath: string): Promise<string | null> {
  try {
    return (await git.currentBranch({ fs, dir: repoPath })) ?? null;
  } catch {
    return null;
  }
}

/**
 * Maps commit object ids to ref names that point at them.
 *
 * @param repoPath - Absolute repository root.
 */
async function buildRefMap(repoPath: string): Promise<Map<string, string[]>> {
  const refByOid = new Map<string, string[]>();

  try {
    const refs = await git.listRefs({ fs, dir: repoPath });
    for (const ref of refs) {
      try {
        const refOid = await git.resolveRef({ fs, dir: repoPath, ref });
        const existing = refByOid.get(refOid) ?? [];
        existing.push(ref);
        refByOid.set(refOid, existing);
      } catch {
        // Skip refs that cannot be resolved.
      }
    }
  } catch {
    return refByOid;
  }

  return refByOid;
}

/**
 * Lists HarborClient-scoped path changes between a commit and its first parent.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id.
 * @param parentOid - First parent commit object id, or null for root commits.
 */
async function listRawCommitFileChanges(
  repoPath: string,
  harborSubdir: string,
  oid: string,
  parentOid: string | null
): Promise<RawCommitFileChange[]> {
  const prefix = normalizeHarborPrefix(harborSubdir);
  const commitFiles = await listTreeFiles(repoPath, oid);
  const parentFiles =
    parentOid != null ? await listTreeFiles(repoPath, parentOid) : new Map<string, string>();

  const paths = new Set<string>([...commitFiles.keys(), ...parentFiles.keys()]);
  const changes: RawCommitFileChange[] = [];

  for (const path of paths) {
    if (!path.startsWith(prefix)) {
      continue;
    }

    const commitFileOid = commitFiles.get(path);
    const parentFileOid = parentFiles.get(path);

    if (commitFileOid == null && parentFileOid != null) {
      changes.push({ path, status: 'deleted' });
      continue;
    }
    if (commitFileOid != null && parentFileOid == null) {
      changes.push({ path, status: 'added' });
      continue;
    }
    if (commitFileOid != null && parentFileOid != null && commitFileOid !== parentFileOid) {
      changes.push({ path, status: 'modified' });
    }
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Groups raw commit path changes into request, document, and plain file rows.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id.
 * @param parentOid - First parent commit object id, or null for root commits.
 * @param rawChanges - Path-level changes for the commit.
 */
async function groupCommitFileChanges(
  repoPath: string,
  harborSubdir: string,
  oid: string,
  parentOid: string | null,
  rawChanges: RawCommitFileChange[]
): Promise<GitCommitFileChange[]> {
  const requestGroups = new Map<
    string,
    {
      paths: string[];
      statuses: GitCommitChangeStatus[];
      metadata: CommitRequestMetadata | null;
    }
  >();
  const documentGroups = new Map<
    string,
    {
      paths: string[];
      statuses: GitCommitChangeStatus[];
      metadata: CommitDocumentMetadata | null;
    }
  >();
  const plainFiles: GitCommitFileChange[] = [];

  for (const change of rawChanges) {
    const collectionUuid = parseCollectionUuidFromPath(change.path, harborSubdir);
    const requestUuid =
      collectionUuid != null && isRequestJsonPath(change.path, harborSubdir, collectionUuid)
        ? parseRequestUuidFromPath(change.path)
        : null;

    if (collectionUuid != null && requestUuid != null) {
      const key = `request:${collectionUuid}:${requestUuid}`;
      const existing = requestGroups.get(key) ?? {
        paths: [],
        statuses: [],
        metadata: null
      };
      existing.paths.push(change.path);
      existing.statuses.push(change.status);
      if (existing.metadata == null) {
        existing.metadata = await readCommitRequestMetadata(
          repoPath,
          harborSubdir,
          oid,
          parentOid,
          change
        );
      }
      requestGroups.set(key, existing);
      continue;
    }

    if (isHarborDocumentPath(change.path, harborSubdir)) {
      const metadata = await readCommitDocumentMetadata(
        repoPath,
        harborSubdir,
        oid,
        parentOid,
        change
      );
      if (metadata != null) {
        const key = `document:${metadata.collectionUuid}:${metadata.uuid}`;
        const existing = documentGroups.get(key) ?? {
          paths: [],
          statuses: [],
          metadata: null
        };
        existing.paths.push(change.path);
        existing.statuses.push(change.status);
        if (existing.metadata == null) {
          existing.metadata = metadata;
        }
        documentGroups.set(key, existing);
        continue;
      }
    }

    plainFiles.push({
      kind: 'file',
      path: change.path,
      status: change.status
    });
  }

  const grouped: GitCommitFileChange[] = [];

  for (const group of requestGroups.values()) {
    const metadata = group.metadata;
    if (metadata == null) {
      for (const path of group.paths) {
        const status = group.statuses[group.paths.indexOf(path)] ?? 'modified';
        plainFiles.push({ kind: 'file', path, status });
      }
      continue;
    }

    const paths = [...group.paths].sort((a, b) => a.localeCompare(b));
    grouped.push({
      kind: 'request',
      path: paths[0] ?? metadata.uuid,
      paths,
      status: aggregateCommitStatuses(group.statuses),
      collectionUuid: metadata.collectionUuid,
      requestUuid: metadata.uuid,
      name: metadata.name,
      method: metadata.method,
      color: metadata.color
    });
  }

  for (const group of documentGroups.values()) {
    const metadata = group.metadata;
    if (metadata == null) {
      continue;
    }

    const paths = [...group.paths].sort((a, b) => a.localeCompare(b));
    grouped.push({
      kind: 'document',
      path: paths[0] ?? metadata.uuid,
      paths,
      status: aggregateCommitStatuses(group.statuses),
      collectionUuid: metadata.collectionUuid,
      documentUuid: metadata.uuid,
      name: metadata.name,
      color: metadata.color
    });
  }

  return [...grouped, ...plainFiles].sort((a, b) => {
    const nameA = a.kind === 'request' ? a.name : a.kind === 'document' ? a.name : a.path;
    const nameB = b.kind === 'request' ? b.name : b.kind === 'document' ? b.name : b.path;
    return nameA.localeCompare(nameB);
  });
}

/**
 * Returns true when a path is a request JSON file for the given collection.
 *
 * @param filepath - Repository-relative path.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param collectionUuid - Stable collection uuid.
 */
function isRequestJsonPath(
  filepath: string,
  harborSubdir: string,
  collectionUuid: string
): boolean {
  return isRequestPathForCollection(filepath, harborSubdir, collectionUuid);
}

/**
 * Aggregates per-path statuses into one resource-level status.
 *
 * @param statuses - Status values for all paths belonging to one resource.
 */
function aggregateCommitStatuses(statuses: GitCommitChangeStatus[]): GitCommitChangeStatus {
  const hasAdded = statuses.includes('added');
  const hasDeleted = statuses.includes('deleted');
  const hasModified = statuses.includes('modified');

  if (hasAdded && hasDeleted) {
    return 'modified';
  }
  if (hasAdded && !hasDeleted && !hasModified) {
    return 'added';
  }
  if (hasDeleted && !hasAdded && !hasModified) {
    return 'deleted';
  }
  return 'modified';
}

/**
 * Reads request metadata from the commit-side or parent-side blob for one path change.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id.
 * @param parentOid - First parent commit object id, or null for root commits.
 * @param change - Path-level change for the request file.
 */
async function readCommitRequestMetadata(
  repoPath: string,
  harborSubdir: string,
  oid: string,
  parentOid: string | null,
  change: RawCommitFileChange
): Promise<CommitRequestMetadata | null> {
  const collectionUuid = parseCollectionUuidFromPath(change.path, harborSubdir);
  const requestUuid = parseRequestUuidFromPath(change.path);
  if (collectionUuid == null || requestUuid == null) {
    return null;
  }

  const preferredCommitOid = change.status === 'deleted' ? parentOid : oid;
  const fallbackCommitOid = change.status === 'deleted' ? oid : parentOid;

  for (const commitRef of [preferredCommitOid, fallbackCommitOid]) {
    if (commitRef == null) {
      continue;
    }
    const raw = await readCommitFileText(repoPath, commitRef, change.path);
    if (raw == null) {
      continue;
    }
    const metadata = parseRequestMetadataFromContent(raw);
    if (metadata != null) {
      return {
        ...metadata,
        collectionUuid
      };
    }
  }

  const fileName = change.path.slice(change.path.lastIndexOf('/') + 1);
  const slugName = parseRequestSlugName(fileName);

  return {
    uuid: requestUuid,
    collectionUuid,
    name: slugName ?? 'Untitled Request',
    method: 'GET',
    color: null
  };
}

/**
 * Reads document metadata from collection.json at a commit, with legacy frontmatter fallback.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id.
 * @param parentOid - First parent commit object id, or null for root commits.
 * @param change - Path-level change for the markdown file.
 */
async function readCommitDocumentMetadata(
  repoPath: string,
  harborSubdir: string,
  oid: string,
  parentOid: string | null,
  change: RawCommitFileChange
): Promise<CommitDocumentMetadata | null> {
  const fileName = change.path.slice(change.path.lastIndexOf('/') + 1);
  const preferredCommitOid = change.status === 'deleted' ? parentOid : oid;
  const fallbackCommitOid = change.status === 'deleted' ? oid : parentOid;
  const prefix = harborSubdir === '.' ? 'collections/' : `${harborSubdir}/collections/`;
  const normalizedFileName = fileName.toLowerCase();

  for (const commitRef of [preferredCommitOid, fallbackCommitOid]) {
    if (commitRef == null) {
      continue;
    }

    let manifestPaths: string[] = [];
    try {
      manifestPaths = await git.listFiles({ fs, dir: repoPath, ref: commitRef });
    } catch {
      manifestPaths = [];
    }

    for (const filepath of manifestPaths) {
      const normalized = filepath.replace(/\\/g, '/');
      if (!normalized.startsWith(prefix) || !normalized.endsWith('/collection.json')) {
        continue;
      }

      const collectionDirName = normalized.slice(prefix.length, -'/collection.json'.length);
      const collectionUuid = parseCollectionDirName(collectionDirName);
      if (!collectionUuid) {
        continue;
      }

      const raw = await readCommitFileText(repoPath, commitRef, normalized);
      if (raw == null) {
        continue;
      }

      try {
        const manifest = JSON.parse(raw) as Record<string, unknown>;
        for (const row of parseStoredDocumentRows(manifest.documents)) {
          if (documentFileName(row.name).toLowerCase() === normalizedFileName) {
            return {
              uuid: row.uuid,
              collectionUuid,
              name: row.name,
              color: row.color ?? null
            };
          }
        }
      } catch {
        continue;
      }
    }

    const markdownRaw = await readCommitFileText(repoPath, commitRef, change.path);
    if (markdownRaw != null) {
      const metadata = parseLegacyDocumentMetadataFromContent(markdownRaw, fileName);
      if (metadata != null) {
        return metadata;
      }
    }
  }

  return null;
}

/**
 * Parses request metadata from one request JSON blob.
 *
 * @param raw - UTF-8 request JSON contents.
 */
function parseRequestMetadataFromContent(
  raw: string
): Omit<CommitRequestMetadata, 'collectionUuid'> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const uuid = typeof parsed.uuid === 'string' ? resolveImportUuid(parsed.uuid) : null;
    if (!uuid) {
      return null;
    }

    return {
      uuid,
      name: String(parsed.name ?? 'Untitled Request').trim() || 'Untitled Request',
      method:
        String(parsed.method ?? 'GET')
          .trim()
          .toUpperCase() || 'GET',
      color:
        parsed.color == null
          ? null
          : typeof parsed.color === 'string'
            ? parsed.color.trim() || null
            : null
    };
  } catch {
    return null;
  }
}

/**
 * Parses document metadata from legacy markdown frontmatter.
 *
 * @param raw - UTF-8 markdown contents.
 * @param fallbackName - File name used when frontmatter omits `name`.
 */
function parseLegacyDocumentMetadataFromContent(
  raw: string,
  fallbackName: string
): CommitDocumentMetadata | null {
  const { frontmatter } = parseMarkdownFrontmatter(raw);
  const uuid = resolveImportUuid(frontmatter.uuid);
  const collectionUuid = resolveImportUuid(frontmatter.collection_uuid);
  if (!uuid || !collectionUuid) {
    return null;
  }

  return {
    uuid,
    collectionUuid,
    name: frontmatter.name.trim() || fallbackName,
    color: frontmatter.color ?? null
  };
}

/**
 * Extracts a human-readable slug suffix from a request file name.
 *
 * @param fileName - Request JSON file name.
 */
function parseRequestSlugName(fileName: string): string | null {
  if (!fileName.endsWith('.json')) {
    return null;
  }
  const base = fileName.slice(0, -5);
  const match = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i.exec(base);
  if (match?.[1] == null) {
    return null;
  }
  return match[1].replace(/-/g, ' ');
}

/**
 * Builds one parent-to-commit diff entry for a changed path.
 *
 * @param repoPath - Absolute repository root.
 * @param oid - Commit object id.
 * @param parentOid - First parent commit object id, or null for root commits.
 * @param path - Repository-relative file path.
 * @param status - Change type for the path.
 */
async function buildCommitPathDiffEntry(
  repoPath: string,
  oid: string,
  parentOid: string | null,
  path: string,
  status: GitCommitChangeStatus
): Promise<GitRequestDiffFileEntry | null> {
  const parentBytes =
    status === 'added' || parentOid == null
      ? null
      : await readCommitFileBytes(repoPath, parentOid, path);
  const commitBytes = status === 'deleted' ? null : await readCommitFileBytes(repoPath, oid, path);

  const parentText = decodeTextContent(parentBytes);
  const commitText = decodeTextContent(commitBytes);
  const binary = parentText == null || commitText == null;

  if (binary) {
    return {
      path,
      status,
      binary: true,
      truncated: false
    };
  }

  const rawDiff = buildCommitFileDiffText(path, status, parentText, commitText);
  const capped = truncateTextForLlm(rawDiff, COMMIT_DIFF_MAX_CHARS_PER_FILE);

  return {
    path,
    status,
    diff: capped.text,
    binary: false,
    truncated: capped.truncated
  };
}

/**
 * Builds a simple before/after diff excerpt for one text file in a commit.
 *
 * @param path - Repository-relative file path.
 * @param status - Added, modified, or deleted status.
 * @param parentText - Text at the parent commit, or empty when absent.
 * @param commitText - Text at the commit, or empty when absent.
 */
function buildCommitFileDiffText(
  path: string,
  status: GitCommitChangeStatus,
  parentText: string,
  commitText: string
): string {
  if (status === 'added') {
    return `--- /dev/null\n+++ ${path}\n${commitText}`;
  }
  if (status === 'deleted') {
    return `--- ${path}\n+++ /dev/null\n${parentText}`;
  }
  return `--- ${path}\n+++ ${path}\n@@ commit changes @@\n${formatBeforeAfter(parentText, commitText)}`;
}

/**
 * Formats parent and commit text as minus/plus prefixed lines.
 *
 * @param before - Text at the parent commit.
 * @param after - Text at the commit.
 */
function formatBeforeAfter(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const removed = beforeLines.map((line) => `-${line}`).join('\n');
  const added = afterLines.map((line) => `+${line}`).join('\n');
  return `${removed}\n${added}`;
}

/**
 * Returns whether a byte buffer should be treated as binary for diff output.
 *
 * @param bytes - File contents from a commit tree.
 */
function isBinaryContent(bytes: Uint8Array): boolean {
  const sample = bytes.slice(0, 8192);
  return sample.includes(0);
}

/**
 * Decodes file bytes as UTF-8 text when not binary.
 *
 * @param bytes - Raw file bytes.
 * @returns Decoded text, or null when binary or invalid UTF-8.
 */
function decodeTextContent(bytes: Uint8Array | null): string | null {
  if (bytes == null || bytes.length === 0) {
    return '';
  }
  if (isBinaryContent(bytes)) {
    return null;
  }
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Reads one file blob as text from a specific commit tree.
 *
 * @param repoPath - Absolute repository root.
 * @param commitOid - Commit object id.
 * @param filepath - Repository-relative path.
 */
async function readCommitFileText(
  repoPath: string,
  commitOid: string,
  filepath: string
): Promise<string | null> {
  const bytes = await readCommitFileBytes(repoPath, commitOid, filepath);
  if (bytes == null) {
    return null;
  }
  if (isBinaryContent(bytes)) {
    return null;
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * Reads one file blob from a specific commit tree.
 *
 * @param repoPath - Absolute repository root.
 * @param commitOid - Commit object id.
 * @param filepath - Repository-relative path.
 */
async function readCommitFileBytes(
  repoPath: string,
  commitOid: string,
  filepath: string
): Promise<Uint8Array | null> {
  let content: Uint8Array | null = null;

  try {
    await git.walk({
      fs,
      dir: repoPath,
      trees: [git.TREE({ ref: commitOid })],
      /**
       * Captures blob content when the walked path matches the target file.
       *
       * @param path - Repository-relative path from the walker.
       * @param trees - Tuple of tree entries; only the commit tree is requested.
       */
      map: async (path, [tree]) => {
        if (path !== filepath || tree == null) {
          return;
        }
        const type = await tree.type();
        if (type === 'blob') {
          const blob = await tree.content();
          if (blob instanceof Uint8Array) {
            content = blob;
          }
        }
      }
    });
  } catch {
    return null;
  }

  return content;
}

/**
 * Normalizes the HarborClient subdirectory to a repository-relative prefix.
 *
 * @param harborSubdir - HarborClient subdirectory setting.
 */
function normalizeHarborPrefix(harborSubdir: string): string {
  const trimmed = harborSubdir.trim();
  if (!trimmed || trimmed === '.') {
    return '';
  }
  return trimmed.replace(/\\/g, '/').replace(/\/+$/, '');
}

/**
 * Lists blob paths and object ids for one commit tree under the repository root.
 *
 * @param repoPath - Absolute repository root.
 * @param oid - Commit object id.
 */
async function listTreeFiles(repoPath: string, oid: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  await git.walk({
    fs,
    dir: repoPath,
    trees: [git.TREE({ ref: oid })],
    /**
     * Records blob paths and oids for the walked commit tree.
     *
     * @param filepath - Repository-relative path.
     * @param entries - Tree walker entries for the current path.
     */
    map: async (filepath, [tree]) => {
      if (tree == null) {
        return;
      }
      const type = await tree.type();
      if (type !== 'blob') {
        return;
      }
      const oidValue = await tree.oid();
      files.set(filepath, oidValue);
    }
  });

  return files;
}
