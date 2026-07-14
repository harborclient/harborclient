import * as git from 'isomorphic-git';
import fs from 'fs';
import { readBlobBytesFromTree } from '#/main/git/gitBlob';
import {
  classifyHarborChangePath,
  COLLECTION_MANIFEST_FILE,
  displayNameFromHarborChange
} from '#/main/git/fileLayout';
import type {
  GitCommitChangeStatus,
  GitCommitDetail,
  GitCommitFileChange,
  GitGraphLogEntry,
  GitGraphLogResult
} from '#/shared/types';

/**
 * One raw path-level change before file classification.
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

  // A repository with no commits (unborn HEAD) has nothing to walk. Return an
  // empty graph instead of letting `git.log` throw NotFoundError for the branch.
  if (headCommitHash == null) {
    return {
      entries: [],
      currentBranch,
      headCommitHash: null
    };
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
  const files = await classifyCommitFileChanges(repoPath, harborSubdir, oid, parentOid, rawChanges);

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
    if (prefix && !path.startsWith(`${prefix}/`) && path !== prefix) {
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
 * Reads UTF-8 text for one blob path at a specific commit.
 *
 * @param repoPath - Absolute repository root.
 * @param commitOid - Commit object id, or null when unavailable.
 * @param filepath - Repository-relative blob path.
 */
async function readBlobTextAtCommit(
  repoPath: string,
  commitOid: string | null,
  filepath: string
): Promise<string | null> {
  if (commitOid == null) {
    return null;
  }

  const content = await readBlobBytesFromTree(repoPath, git.TREE({ ref: commitOid }), filepath);

  if (content == null) {
    return null;
  }

  try {
    return Buffer.from(content).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Classifies raw commit path changes into HarborClient file rows for the UI.
 *
 * Drops plumbing paths such as `.gitignore` and `collection.json`, labels request
 * and markdown files with friendly display names, and keeps environment/snippet rows.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id.
 * @param parentOid - First parent commit object id, or null for root commits.
 * @param rawChanges - Path-level changes for the commit.
 */
async function classifyCommitFileChanges(
  repoPath: string,
  harborSubdir: string,
  oid: string,
  parentOid: string | null,
  rawChanges: RawCommitFileChange[]
): Promise<GitCommitFileChange[]> {
  const results: GitCommitFileChange[] = [];

  for (const change of rawChanges) {
    const classified = classifyHarborChangePath(change.path, harborSubdir);
    if (classified == null) {
      continue;
    }
    if (classified.kind === 'other' && classified.fileName === '.gitignore') {
      continue;
    }
    if (classified.kind === 'collectionMeta') {
      continue;
    }

    if (classified.kind === 'request' || classified.kind === 'document') {
      const contentOid = change.status === 'deleted' ? parentOid : oid;
      const contentText = await readBlobTextAtCommit(repoPath, contentOid, change.path);
      let manifestText: string | null = null;
      if (classified.kind === 'document') {
        const manifestPath = change.path.replace(/[^/]+$/, COLLECTION_MANIFEST_FILE);
        const manifestOid = change.status === 'deleted' ? parentOid : oid;
        manifestText = await readBlobTextAtCommit(repoPath, manifestOid, manifestPath);
      }
      const meta = displayNameFromHarborChange(classified, contentText, manifestText);
      results.push({
        kind: 'file',
        path: change.path,
        status: change.status,
        displayName: meta.displayName,
        resourceKind: meta.resourceKind
      });
      continue;
    }

    if (classified.kind === 'environment' || classified.kind === 'snippet') {
      results.push({
        kind: 'file',
        path: change.path,
        status: change.status
      });
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
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
