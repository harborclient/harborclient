import * as git from 'isomorphic-git';
import fs from 'fs';
import { GIT_DIFF_DEFAULT_MAX_CHARS_PER_FILE } from '#/main/git/gitDiff';
import { buildFileDiffText } from '#/main/git/gitDiff';
import { truncateTextForLlm } from '#/shared/ai/chatContext';
import type { GitLogEntry } from '#/shared/types';

/**
 * Options for reading a file diff between two commits.
 */
export interface FileCommitDiffOptions {
  /**
   * Absolute repository root path.
   */
  repoPath: string;

  /**
   * Repository-relative file path to diff.
   */
  filepath: string;

  /**
   * Older commit object id (parent side of the diff).
   */
  commitA: string;

  /**
   * Newer commit object id (child side of the diff).
   */
  commitB: string;

  /**
   * Maximum diff characters to return; defaults to 4000.
   */
  maxChars?: number;
}

/**
 * Result of comparing one file between two commits.
 */
export interface FileCommitDiffResult {
  /**
   * Repository-relative file path that was compared.
   */
  path: string;

  /**
   * Older commit object id.
   */
  commitA: string;

  /**
   * Newer commit object id.
   */
  commitB: string;

  /**
   * Unified diff text, or null when the file is binary or absent at both commits.
   */
  diff: string | null;

  /**
   * Whether the diff text was truncated to fit the character budget.
   */
  truncated: boolean;

  /**
   * Whether either commit version could not be decoded as UTF-8 text.
   */
  binary: boolean;

  /**
   * Original diff length before truncation, when truncated is true.
   */
  originalLength?: number;
}

/**
 * Returns commit history for one repository-relative file path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative file path.
 * @param depth - Maximum number of commits to walk.
 */
export async function readFileCommitHistory(
  repoPath: string,
  filepath: string,
  depth = 20
): Promise<GitLogEntry[]> {
  try {
    const commits = await git.log({
      fs,
      dir: repoPath,
      filepath,
      depth
    });
    return commits.map((entry) => ({
      oid: entry.oid,
      message: entry.commit.message.split('\n')[0] ?? '',
      author: entry.commit.author.name,
      timestamp: new Date(entry.commit.author.timestamp * 1000).toISOString()
    }));
  } catch {
    return [];
  }
}

/**
 * Returns true when bytes look like non-text content.
 *
 * @param bytes - Raw file bytes.
 */
function isBinaryContent(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8000));
  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Decodes blob bytes as UTF-8 text when the content is textual.
 *
 * @param bytes - Raw blob bytes, or null when the blob is absent at the commit.
 */
function decodeBlobText(bytes: Uint8Array | null): string | null | undefined {
  if (bytes == null) {
    return undefined;
  }
  if (bytes.length === 0) {
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
 * Reads raw blob bytes for one path at a specific commit.
 *
 * @param repoPath - Absolute repository root.
 * @param commitOid - Commit object id.
 * @param filepath - Repository-relative blob path.
 */
async function readBlobBytesAtCommit(
  repoPath: string,
  commitOid: string,
  filepath: string
): Promise<Uint8Array | null> {
  let content: Uint8Array | null = null;
  await git.walk({
    fs,
    dir: repoPath,
    trees: [git.TREE({ ref: commitOid })],
    /**
     * Captures blob bytes when the walked path matches the target file.
     *
     * @param path - Repository-relative path from the walker.
     * @param trees - Tuple of tree entries for the current commit.
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
  return content;
}

/**
 * Reads UTF-8 text for one blob path at a specific commit.
 *
 * @param repoPath - Absolute repository root.
 * @param commitOid - Commit object id, or null when unavailable.
 * @param filepath - Repository-relative blob path.
 */
export async function readBlobTextAtCommit(
  repoPath: string,
  commitOid: string | null,
  filepath: string
): Promise<string | null> {
  if (commitOid == null) {
    return null;
  }

  const bytes = await readBlobBytesAtCommit(repoPath, commitOid, filepath);
  const decoded = decodeBlobText(bytes);
  if (decoded === undefined) {
    return null;
  }
  return decoded;
}

/**
 * Builds a diff of one file between two commits.
 *
 * @param options - Repository path, file path, commit range, and output cap.
 */
export async function buildFileCommitDiff(
  options: FileCommitDiffOptions
): Promise<FileCommitDiffResult> {
  const maxChars = options.maxChars ?? GIT_DIFF_DEFAULT_MAX_CHARS_PER_FILE;
  const bytesA = await readBlobBytesAtCommit(options.repoPath, options.commitA, options.filepath);
  const bytesB = await readBlobBytesAtCommit(options.repoPath, options.commitB, options.filepath);
  const textA = decodeBlobText(bytesA);
  const textB = decodeBlobText(bytesB);

  if (textA === null || textB === null) {
    return {
      path: options.filepath,
      commitA: options.commitA,
      commitB: options.commitB,
      diff: null,
      truncated: false,
      binary: true
    };
  }

  const normalizedA = textA ?? '';
  const normalizedB = textB ?? '';
  let status: 'added' | 'modified' | 'deleted';
  if (textA === undefined && textB !== undefined) {
    status = 'added';
  } else if (textA !== undefined && textB === undefined) {
    status = 'deleted';
  } else {
    status = 'modified';
  }

  const rawDiff = buildFileDiffText(options.filepath, status, normalizedA, normalizedB);
  const capped = truncateTextForLlm(rawDiff, maxChars);

  return {
    path: options.filepath,
    commitA: options.commitA,
    commitB: options.commitB,
    diff: capped.text,
    truncated: capped.truncated,
    binary: false,
    ...(capped.truncated ? { originalLength: capped.originalLength } : {})
  };
}
