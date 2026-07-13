import * as git from 'isomorphic-git';
import fs, { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { truncateTextForLlm } from '#/shared/ai/chatContext';

/**
 * Default maximum number of changed files included in a git diff payload.
 */
export const GIT_DIFF_DEFAULT_MAX_FILES = 40;

/**
 * Default maximum characters per file diff excerpt.
 */
export const GIT_DIFF_DEFAULT_MAX_CHARS_PER_FILE = 4_000;

/**
 * Default maximum total characters across all file diffs.
 */
export const GIT_DIFF_DEFAULT_MAX_TOTAL_CHARS = 32_000;

/**
 * File change status returned by git_diff.
 */
export type GitDiffFileStatus = 'added' | 'modified' | 'deleted';

/**
 * One changed file entry in a git diff result.
 */
export interface GitDiffFileEntry {
  /**
   * Repository-relative path under the HarborClient subdirectory.
   */
  path: string;

  /**
   * Added, modified, or deleted relative to HEAD.
   */
  status: GitDiffFileStatus;

  /**
   * Unified-style diff excerpt when the file is text; omitted for binary files.
   */
  diff?: string;

  /**
   * Whether the file was treated as binary and diff text was omitted.
   */
  binary: boolean;

  /**
   * Whether this file's diff was truncated by per-file or total caps.
   */
  truncated: boolean;

  /**
   * Original diff character length before truncation, when truncated.
   */
  originalLength?: number;
}

/**
 * Structured git diff payload returned to the AI agent.
 */
export interface GitDiffResult {
  /**
   * Git connection id for the resolved collection.
   */
  connectionId: string;

  /**
   * Current branch name, or null when detached or unknown.
   */
  branch: string | null;

  /**
   * HarborClient subdirectory scoped by this repository.
   */
  harborSubdir: string;

  /**
   * Number of changed files under the HarborClient tree.
   */
  changedFileCount: number;

  /**
   * Changed files included in this payload (may be capped).
   */
  files: GitDiffFileEntry[];

  /**
   * Whether file count or total character budget caused omissions.
   */
  truncated: boolean;

  /**
   * Number of changed files omitted from the files array.
   */
  omittedFileCount: number;

  /**
   * Error message when diff generation failed.
   */
  error?: string;
}

/**
 * Options for building a HarborClient git diff.
 */
export interface GitDiffOptions {
  /**
   * Absolute repository root path.
   */
  repoPath: string;

  /**
   * HarborClient subdirectory relative to the repository root.
   */
  harborSubdir: string;

  /**
   * Maximum number of files to include.
   */
  maxFiles?: number;

  /**
   * Maximum characters per file diff excerpt.
   */
  maxCharsPerFile?: number;

  /**
   * Maximum total characters across all file excerpts.
   */
  maxTotalChars?: number;
}

/**
 * Returns whether a byte buffer should be treated as binary for diff output.
 *
 * @param bytes - File contents from HEAD or the working tree.
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
 * Reads a file blob from HEAD for a repository-relative path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative path.
 */
async function readHeadFile(repoPath: string, filepath: string): Promise<Uint8Array | null> {
  let content: Uint8Array | null = null;

  try {
    await git.walk({
      fs,
      dir: repoPath,
      trees: [git.TREE({ ref: 'HEAD' })],
      /**
       * Captures blob content when the walked path matches the target file.
       *
       * @param path - Repository-relative path from the walker.
       * @param trees - Tuple of tree entries; only HEAD is requested.
       */
      map: async (path, [head]) => {
        if (path !== filepath || head == null) {
          return;
        }
        const type = await head.type();
        if (type === 'blob') {
          const blob = await head.content();
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
 * Reads a working-tree file for a repository-relative path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative path.
 */
function readWorkdirFile(repoPath: string, filepath: string): Uint8Array | null {
  const fullPath = join(repoPath, filepath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return Uint8Array.from(readFileSync(fullPath));
}

/**
 * Derives a file status from one isomorphic-git statusMatrix row.
 *
 * @param head - HEAD stage flag (0 absent, 1 present).
 * @param workdir - Workdir stage flag (0 absent, 1 same, 2 different).
 */
function resolveFileStatus(head: number, workdir: number): GitDiffFileStatus | null {
  if (head === 0 && workdir !== 0) {
    return 'added';
  }
  if (head !== 0 && workdir === 0) {
    return 'deleted';
  }
  if (head !== 0 && workdir === 2) {
    return 'modified';
  }
  return null;
}

/**
 * Builds a simple before/after diff excerpt for one text file.
 *
 * @param path - Repository-relative file path.
 * @param status - Added, modified, or deleted status.
 * @param headText - Text at HEAD, or null when absent.
 * @param workText - Text in the working tree, or null when absent.
 */
function buildFileDiffText(
  path: string,
  status: GitDiffFileStatus,
  headText: string | null,
  workText: string | null
): string {
  if (status === 'added') {
    return `--- /dev/null\n+++ ${path}\n${workText ?? ''}`;
  }
  if (status === 'deleted') {
    return `--- ${path}\n+++ /dev/null\n${headText ?? ''}`;
  }
  return `--- ${path}\n+++ ${path}\n@@ working tree changes @@\n${formatBeforeAfter(headText ?? '', workText ?? '')}`;
}

/**
 * Formats HEAD and working-tree text as minus/plus prefixed lines.
 *
 * @param before - Text at HEAD.
 * @param after - Text in the working tree.
 */
function formatBeforeAfter(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const removed = beforeLines.map((line) => `-${line}`).join('\n');
  const added = afterLines.map((line) => `+${line}`).join('\n');
  return `${removed}\n${added}`;
}

/**
 * Builds a capped git diff for all uncommitted changes under the HarborClient tree.
 *
 * @param options - Repository path, harbor subdirectory, and output caps.
 */
export async function buildGitDiff(options: GitDiffOptions): Promise<GitDiffResult> {
  const maxFiles = options.maxFiles ?? GIT_DIFF_DEFAULT_MAX_FILES;
  const maxCharsPerFile = options.maxCharsPerFile ?? GIT_DIFF_DEFAULT_MAX_CHARS_PER_FILE;
  const maxTotalChars = options.maxTotalChars ?? GIT_DIFF_DEFAULT_MAX_TOTAL_CHARS;
  const harborSubdir = options.harborSubdir;
  const repoPath = options.repoPath;

  const matrix = await git.statusMatrix({
    fs,
    dir: repoPath,
    filepaths: [harborSubdir]
  });

  const changedRows = matrix.filter(([filepath, head, workdir, stage]) => {
    void filepath;
    return head !== workdir || head !== stage || workdir !== stage;
  });

  let branch: string | null = null;
  try {
    branch = (await git.currentBranch({ fs, dir: repoPath })) ?? null;
  } catch {
    branch = null;
  }

  const files: GitDiffFileEntry[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const [filepath, head, workdir] of changedRows) {
    if (files.length >= maxFiles) {
      truncated = true;
      break;
    }

    const status = resolveFileStatus(head, workdir);
    if (status == null) {
      continue;
    }

    const headBytes = status === 'added' ? null : await readHeadFile(repoPath, filepath);
    const workBytes = status === 'deleted' ? null : readWorkdirFile(repoPath, filepath);
    const headText = decodeTextContent(headBytes);
    const workText = decodeTextContent(workBytes);
    const binary = headText == null || workText == null;

    if (binary) {
      files.push({
        path: filepath,
        status,
        binary: true,
        truncated: false
      });
      continue;
    }

    const rawDiff = buildFileDiffText(filepath, status, headText, workText);
    const remainingBudget = maxTotalChars - totalChars;
    const perFileBudget = Math.min(maxCharsPerFile, remainingBudget);

    if (perFileBudget <= 0) {
      truncated = true;
      break;
    }

    const capped = truncateTextForLlm(rawDiff, perFileBudget);
    totalChars += capped.text.length;

    files.push({
      path: filepath,
      status,
      diff: capped.text,
      binary: false,
      truncated: capped.truncated,
      ...(capped.truncated ? { originalLength: capped.originalLength } : {})
    });

    if (capped.truncated || totalChars >= maxTotalChars) {
      truncated = true;
      break;
    }
  }

  const omittedFileCount = Math.max(0, changedRows.length - files.length);

  return {
    connectionId: '',
    branch,
    harborSubdir,
    changedFileCount: changedRows.length,
    files,
    truncated: truncated || omittedFileCount > 0,
    omittedFileCount
  };
}
