import * as git from 'isomorphic-git';
import fs from 'fs';
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
  const files = classifyCommitFileChanges(repoPath, harborSubdir, oid, parentOid, rawChanges);

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
    if (!prefix && path.includes('/')) {
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
 * Classifies raw commit path changes into flat HarborClient file rows.
 *
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param oid - Commit object id.
 * @param parentOid - First parent commit object id, or null for root commits.
 * @param rawChanges - Path-level changes for the commit.
 */
function classifyCommitFileChanges(
  _repoPath: string,
  _harborSubdir: string,
  _oid: string,
  _parentOid: string | null,
  rawChanges: RawCommitFileChange[]
): GitCommitFileChange[] {
  return rawChanges.map((change) => ({
    kind: 'file' as const,
    path: change.path,
    status: change.status
  }));
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
