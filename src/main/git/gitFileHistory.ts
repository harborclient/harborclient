import * as git from 'isomorphic-git';
import fs from 'fs';
import { readBlobBytesFromTree } from '#/main/git/gitBlob';
import { decodeBlobText } from '#/main/git/gitBlobText';
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
  return readBlobBytesFromTree(repoPath, git.TREE({ ref: commitOid }), filepath);
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
