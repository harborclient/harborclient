import * as git from 'isomorphic-git';
import fs, { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { truncateTextForLlm } from '#/shared/ai/chatContext';
import { hasConflictMarkers } from './slug';
import { readBlobBytesFromTree } from './gitBlob';
import {
  classifyHarborChangePath,
  displayNameFromHarborChange,
  parseRequestUuidFromText,
  type ClassifiedHarborChangePath
} from './fileLayout';
import { decodeTextContent } from './gitBlobText';
import {
  analyzeMatrixRow,
  isCountedCollectionChange,
  type GitMatrixChangeStatus,
  type GitMatrixRow,
  type GitRequestRowFlags
} from './gitRequestStatus';

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
export type GitDiffFileStatus = GitMatrixChangeStatus;

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
   * Whether the working-tree file contains unresolved merge conflict markers.
   */
  hasConflict: boolean;

  /**
   * Original diff character length before truncation, when truncated.
   */
  originalLength?: number;

  /**
   * User-facing request or document name when resolved from file contents.
   */
  displayName?: string;

  /**
   * HarborClient resource kind for filtered Changes list rows.
   */
  resourceKind?: 'request' | 'document';

  /**
   * HTTP method for request rows when resolved from file contents.
   */
  method?: string;

  /**
   * Repository-relative paths removed during a rename, when this row represents a
   * collapsed delete+add pair for one request uuid.
   */
  previousPaths?: string[];

  /**
   * User-facing name from the deleted path during a rename, when resolved.
   */
  renamedFrom?: string;
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
 * Options for building one rename-aware resource diff entry.
 */
export interface SingleResourceDiffOptions {
  /**
   * Absolute repository root path.
   */
  repoPath: string;

  /**
   * Repository-relative path at HEAD, or null when the resource is newly added.
   */
  headPath: string | null;

  /**
   * Repository-relative path in the working tree, or null when deleted.
   */
  workPath: string | null;

  /**
   * Maximum characters for the diff excerpt.
   */
  maxCharsPerFile?: number;
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

  /**
   * When true, includes only staged changes (HEAD vs index) instead of working-tree changes.
   */
  stagedOnly?: boolean;

  /**
   * When set, includes only changed files whose repository-relative path passes this filter.
   */
  filepathFilter?: (filepath: string) => boolean;

  /**
   * When true, resolves `displayName` and `resourceKind` for request and document paths.
   */
  enrichDisplayNames?: boolean;

  /**
   * When true, omits untracked files (not yet added to git) from the diff payload.
   */
  excludeUntracked?: boolean;
}

/**
 * Returns whether a classified Harbor path should appear in collection-scoped diffs.
 *
 * @param classified - Parsed HarborClient path metadata.
 * @param collectionDir - On-disk collection folder name to scope.
 */
export function isCollectionScopedHarborChange(
  classified: ClassifiedHarborChangePath,
  collectionDir: string
): boolean {
  if (classified.kind !== 'request' && classified.kind !== 'document') {
    return false;
  }
  return classified.collectionDir === collectionDir;
}

/**
 * Returns a filepath filter that keeps only request/document changes under one collection folder.
 *
 * @param harborSubdir - HarborClient subdirectory setting from sync status.
 * @param collectionDir - On-disk collection folder name (from `collectionDirName`).
 */
export function makeCollectionScopedFilter(
  harborSubdir: string,
  collectionDir: string
): (filepath: string) => boolean {
  return (filepath) => {
    const classified = classifyHarborChangePath(filepath, harborSubdir);
    if (classified == null) {
      return false;
    }
    return isCollectionScopedHarborChange(classified, collectionDir);
  };
}

/**
 * Builds a repository-relative prefix for one collection folder.
 *
 * @param harborSubdir - HarborClient subdirectory setting.
 * @param collectionDir - On-disk collection folder name.
 */
export function buildCollectionFolderPrefix(harborSubdir: string, collectionDir: string): string {
  const trimmed = harborSubdir.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!trimmed || trimmed === '.') {
    return `${collectionDir}/`;
  }
  return `${trimmed}/${collectionDir}/`;
}

/**
 * Reads UTF-8 text from a working-tree file when present.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative path.
 */
function readWorkdirText(repoPath: string, filepath: string): string | null {
  const bytes = readWorkdirFile(repoPath, filepath);
  return decodeTextContent(bytes);
}

/**
 * Reads UTF-8 text from HEAD for one repository-relative path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative path.
 */
async function readHeadText(repoPath: string, filepath: string): Promise<string | null> {
  const bytes = await readHeadFile(repoPath, filepath);
  return decodeTextContent(bytes);
}

/**
 * Resolves display metadata for one changed Harbor request or document path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative changed path.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param status - Added, modified, or deleted relative to HEAD.
 * @param headText - Decoded HEAD content for the changed file, when available.
 * @param compareText - Decoded working-tree or index content for the changed file.
 */
async function resolveDiffDisplayMeta(
  repoPath: string,
  filepath: string,
  harborSubdir: string,
  status: GitDiffFileStatus,
  headText: string | null,
  compareText: string | null
): Promise<{ displayName: string; resourceKind: 'request' | 'document'; method?: string } | null> {
  const classified = classifyHarborChangePath(filepath, harborSubdir);
  if (classified == null || (classified.kind !== 'request' && classified.kind !== 'document')) {
    return null;
  }

  const contentText = status === 'deleted' ? headText : compareText;
  let manifestText: string | null = null;
  if (classified.kind === 'document') {
    const manifestPath = filepath.replace(/[^/]+$/, 'collection.json');
    const manifestHead = status === 'added' ? null : await readHeadText(repoPath, manifestPath);
    const manifestWork = status === 'deleted' ? null : readWorkdirText(repoPath, manifestPath);
    manifestText = status === 'deleted' ? manifestHead : (manifestWork ?? manifestHead);
  }

  return displayNameFromHarborChange(classified, contentText, manifestText);
}

/**
 * Reads a file blob from HEAD for a repository-relative path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative path.
 */
async function readHeadFile(repoPath: string, filepath: string): Promise<Uint8Array | null> {
  return readBlobBytesFromTree(repoPath, git.TREE({ ref: 'HEAD' }), filepath);
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
 * Reads a staged file blob from the index for a repository-relative path.
 *
 * @param repoPath - Absolute repository root.
 * @param filepath - Repository-relative path.
 */
async function readStageFile(repoPath: string, filepath: string): Promise<Uint8Array | null> {
  return readBlobBytesFromTree(repoPath, git.STAGE(), filepath);
}

/**
 * Builds a simple before/after diff excerpt for one text file.
 *
 * @param path - Repository-relative file path.
 * @param status - Added, modified, or deleted status.
 * @param headText - Text at HEAD, or null when absent.
 * @param workText - Text in the working tree or index, or null when absent.
 */
export function buildFileDiffText(
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
 * Builds one capped diff entry comparing HEAD and working-tree content for a single
 * resource, including renames where HEAD and working paths differ.
 *
 * @param options - Repository path and optional HEAD/working paths.
 * @returns One diff entry, or null when both paths are absent.
 */
export async function buildSingleResourceDiff(
  options: SingleResourceDiffOptions
): Promise<GitDiffFileEntry | null> {
  const { repoPath, headPath, workPath } = options;
  const maxCharsPerFile = options.maxCharsPerFile ?? GIT_DIFF_DEFAULT_MAX_CHARS_PER_FILE;

  if (headPath == null && workPath == null) {
    return null;
  }

  let status: GitDiffFileStatus;
  let displayPath: string;

  if (headPath == null) {
    status = 'added';
    displayPath = workPath as string;
  } else if (workPath == null) {
    status = 'deleted';
    displayPath = headPath;
  } else {
    status = 'modified';
    displayPath = workPath;
  }

  const headBytes = headPath != null ? await readHeadFile(repoPath, headPath) : null;
  const workBytes = workPath != null ? readWorkdirFile(repoPath, workPath) : null;
  const headText = headPath == null ? '' : decodeTextContent(headBytes);
  const workText = workPath == null ? '' : decodeTextContent(workBytes);
  const binary = (headPath != null && headText == null) || (workPath != null && workText == null);

  if (binary) {
    return {
      path: displayPath,
      status,
      binary: true,
      truncated: false,
      hasConflict: hasConflictMarkers(workText)
    };
  }

  const rawDiff = buildFileDiffText(displayPath, status, headText, workText);
  const capped = truncateTextForLlm(rawDiff, maxCharsPerFile);

  return {
    path: displayPath,
    status,
    diff: capped.text,
    binary: false,
    truncated: capped.truncated,
    hasConflict: hasConflictMarkers(workText),
    ...(capped.truncated ? { originalLength: capped.originalLength } : {})
  };
}

/**
 * Resolves the change label shown for one diff row.
 *
 * When comparing the working tree to HEAD, falls back to the staged label so
 * staged-only tracked files appear in collection change lists.
 *
 * @param flags - Change flags from {@link analyzeMatrixRow}.
 * @param stagedOnly - When true, compare the index to HEAD only.
 */
function resolveGitDiffRowStatus(
  flags: GitRequestRowFlags,
  stagedOnly: boolean
): GitMatrixChangeStatus | null {
  if (stagedOnly) {
    return flags.stagedChangeStatus;
  }
  return flags.workdirChangeStatus ?? flags.stagedChangeStatus;
}

/**
 * Chooses whether diff content should come from the index or working tree.
 *
 * @param flags - Change flags from {@link analyzeMatrixRow}.
 * @param stagedOnly - When true, compare the index to HEAD only.
 * @param status - Resolved row status label.
 */
function shouldReadStageForGitDiff(
  flags: GitRequestRowFlags,
  stagedOnly: boolean,
  status: GitMatrixChangeStatus
): boolean {
  if (status === 'deleted') {
    return false;
  }
  if (stagedOnly) {
    return true;
  }
  return flags.workdirChangeStatus == null && flags.stagedChangeStatus != null;
}

/**
 * One request change row with resolved uuid and decoded file bodies for rename pairing.
 */
interface PendingRequestChange {
  /**
   * Diff entry built from one statusMatrix row.
   */
  entry: GitDiffFileEntry;

  /**
   * Stable request uuid parsed from file JSON, when present.
   */
  uuid: string | null;

  /**
   * Decoded HEAD content for the changed path.
   */
  headText: string | null;

  /**
   * Decoded working-tree or index content for the changed path.
   */
  compareText: string | null;
}

/**
 * Returns whether one matrix row should be included when building a git diff.
 *
 * Untracked request rows are retained for collection-scoped rename pairing even
 * when `excludeUntracked` is true.
 *
 * @param row - statusMatrix row from isomorphic-git.
 * @param options - Diff build options and harbor subdirectory prefix.
 */
function shouldIncludeMatrixRowForGitDiff(
  row: GitMatrixRow,
  options: {
    stagedOnly: boolean;
    excludeUntracked: boolean;
    filepathFilter?: (filepath: string) => boolean;
    enrichDisplayNames?: boolean;
    harborSubdir: string;
  }
): boolean {
  const flags = analyzeMatrixRow(row);
  if (flags == null) {
    return false;
  }
  if (options.stagedOnly) {
    return flags.hasStagedChanges;
  }
  if (options.excludeUntracked && !isCountedCollectionChange(flags)) {
    if (
      flags.isUntracked &&
      options.filepathFilter != null &&
      options.enrichDisplayNames &&
      options.filepathFilter(row[0])
    ) {
      const classified = classifyHarborChangePath(row[0], options.harborSubdir);
      return classified?.kind === 'request';
    }
    return false;
  }
  return true;
}

/**
 * Collapses delete+add request changes that share one uuid into a single modified row.
 *
 * @param entries - Raw per-path diff entries.
 * @param repoPath - Absolute repository root.
 * @param harborSubdir - HarborClient subdirectory prefix.
 * @param maxCharsPerFile - Maximum characters per merged diff excerpt.
 * @param excludeUntracked - When true, omits unpaired untracked request additions.
 * @param untrackedPaths - Repository-relative paths that are not yet tracked in HEAD.
 */
export async function collapseRequestRenames(
  entries: GitDiffFileEntry[],
  repoPath: string,
  harborSubdir: string,
  maxCharsPerFile: number,
  excludeUntracked: boolean,
  untrackedPaths: ReadonlySet<string>
): Promise<GitDiffFileEntry[]> {
  const requestEntries: GitDiffFileEntry[] = [];
  const otherEntries: GitDiffFileEntry[] = [];

  for (const entry of entries) {
    const classified = classifyHarborChangePath(entry.path, harborSubdir);
    if (classified?.kind === 'request') {
      requestEntries.push(entry);
    } else {
      otherEntries.push(entry);
    }
  }

  if (requestEntries.length === 0) {
    return entries;
  }

  const pending: PendingRequestChange[] = [];
  for (const entry of requestEntries) {
    const headText = entry.status === 'added' ? null : await readHeadText(repoPath, entry.path);
    const compareText = entry.status === 'deleted' ? null : readWorkdirText(repoPath, entry.path);
    const contentForUuid = entry.status === 'deleted' ? headText : compareText;
    pending.push({
      entry,
      uuid: parseRequestUuidFromText(contentForUuid),
      headText,
      compareText
    });
  }

  const groups = new Map<string, PendingRequestChange[]>();
  const ungrouped: PendingRequestChange[] = [];

  for (const item of pending) {
    if (item.uuid == null) {
      ungrouped.push(item);
      continue;
    }
    const group = groups.get(item.uuid) ?? [];
    group.push(item);
    groups.set(item.uuid, group);
  }

  const collapsed: GitDiffFileEntry[] = [...otherEntries];

  for (const group of groups.values()) {
    const deletions = group.filter((item) => item.entry.status === 'deleted');
    const survivors = group.filter((item) => item.entry.status !== 'deleted');

    if (survivors.length > 0 && deletions.length > 0) {
      const survivor =
        survivors.find((item) => item.entry.status === 'added') ??
        survivors.find((item) => item.entry.status === 'modified') ??
        survivors[0]!;
      const primaryDeletion = deletions[0]!;
      const previousPaths = deletions.map((item) => item.entry.path);
      const mergedDiff = buildFileDiffText(
        survivor.entry.path,
        'modified',
        primaryDeletion.headText,
        survivor.compareText
      );
      const capped = truncateTextForLlm(mergedDiff, maxCharsPerFile);
      const deletedClassified = classifyHarborChangePath(primaryDeletion.entry.path, harborSubdir);
      const renamedFromMeta =
        deletedClassified != null
          ? displayNameFromHarborChange(deletedClassified, primaryDeletion.headText, null)
          : null;

      collapsed.push({
        path: survivor.entry.path,
        status: 'modified',
        diff: capped.text,
        binary: false,
        truncated: capped.truncated,
        hasConflict: survivor.entry.hasConflict,
        displayName: survivor.entry.displayName ?? renamedFromMeta?.displayName,
        resourceKind: 'request',
        ...(survivor.entry.method != null
          ? { method: survivor.entry.method }
          : renamedFromMeta?.method != null
            ? { method: renamedFromMeta.method }
            : {}),
        previousPaths,
        ...(renamedFromMeta?.displayName != null
          ? { renamedFrom: renamedFromMeta.displayName }
          : {}),
        ...(capped.truncated ? { originalLength: capped.originalLength } : {})
      });
      continue;
    }

    if (deletions.length > 0) {
      collapsed.push(deletions[0]!.entry);
      continue;
    }

    for (const survivor of survivors) {
      if (
        excludeUntracked &&
        survivor.entry.status === 'added' &&
        untrackedPaths.has(survivor.entry.path)
      ) {
        continue;
      }
      collapsed.push(survivor.entry);
    }
  }

  for (const item of ungrouped) {
    if (excludeUntracked && item.entry.status === 'added' && untrackedPaths.has(item.entry.path)) {
      continue;
    }
    collapsed.push(item.entry);
  }

  return collapsed;
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

  const stagedOnly = options.stagedOnly === true;
  const excludeUntracked = options.excludeUntracked === true;
  const untrackedPaths = new Set(
    matrix
      .filter((row) => analyzeMatrixRow(row as GitMatrixRow)?.isUntracked === true)
      .map(([filepath]) => filepath)
  );
  const changedRows = matrix.filter((row) =>
    shouldIncludeMatrixRowForGitDiff(row as GitMatrixRow, {
      stagedOnly,
      excludeUntracked,
      filepathFilter: options.filepathFilter,
      enrichDisplayNames: options.enrichDisplayNames,
      harborSubdir
    })
  );

  let branch: string | null = null;
  try {
    branch = (await git.currentBranch({ fs, dir: repoPath })) ?? null;
  } catch {
    branch = null;
  }

  const files: GitDiffFileEntry[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const row of changedRows) {
    const [filepath] = row;
    if (options.filepathFilter != null && !options.filepathFilter(filepath)) {
      continue;
    }
    if (files.length >= maxFiles) {
      truncated = true;
      break;
    }

    const flags = analyzeMatrixRow(row as GitMatrixRow);
    if (flags == null) {
      continue;
    }
    const status = resolveGitDiffRowStatus(flags, stagedOnly);
    if (status == null) {
      continue;
    }

    const headBytes = status === 'added' ? null : await readHeadFile(repoPath, filepath);
    const readStage = shouldReadStageForGitDiff(flags, stagedOnly, status);
    const compareBytes = readStage
      ? status === 'deleted'
        ? null
        : await readStageFile(repoPath, filepath)
      : status === 'deleted'
        ? null
        : readWorkdirFile(repoPath, filepath);
    const headText = decodeTextContent(headBytes);
    const compareText = decodeTextContent(compareBytes);
    const binary = headText == null || compareText == null;

    if (binary) {
      files.push({
        path: filepath,
        status,
        binary: true,
        truncated: false,
        hasConflict: false
      });
      continue;
    }

    const hasConflict = hasConflictMarkers(compareText);

    const rawDiff = buildFileDiffText(filepath, status, headText, compareText);
    const remainingBudget = maxTotalChars - totalChars;
    const perFileBudget = Math.min(maxCharsPerFile, remainingBudget);

    const classified = options.enrichDisplayNames
      ? classifyHarborChangePath(filepath, harborSubdir)
      : null;
    const displayMeta =
      classified != null && options.enrichDisplayNames
        ? await resolveDiffDisplayMeta(
            repoPath,
            filepath,
            harborSubdir,
            status,
            headText,
            compareText
          )
        : null;

    if (perFileBudget <= 0) {
      files.push({
        path: filepath,
        status,
        diff: '',
        binary: false,
        truncated: true,
        hasConflict,
        originalLength: rawDiff.length,
        ...(displayMeta
          ? {
              displayName: displayMeta.displayName,
              resourceKind: displayMeta.resourceKind,
              ...(displayMeta.method != null ? { method: displayMeta.method } : {})
            }
          : {})
      });
      truncated = true;
      continue;
    }

    const capped = truncateTextForLlm(rawDiff, perFileBudget);
    totalChars += capped.text.length;

    files.push({
      path: filepath,
      status,
      diff: capped.text,
      binary: false,
      truncated: capped.truncated,
      hasConflict,
      ...(capped.truncated ? { originalLength: capped.originalLength } : {}),
      ...(displayMeta
        ? {
            displayName: displayMeta.displayName,
            resourceKind: displayMeta.resourceKind,
            ...(displayMeta.method != null ? { method: displayMeta.method } : {})
          }
        : {})
    });

    if (capped.truncated || totalChars >= maxTotalChars) {
      truncated = true;
    }
  }

  const collapsedFiles =
    options.enrichDisplayNames && options.filepathFilter != null
      ? await collapseRequestRenames(
          files,
          repoPath,
          harborSubdir,
          maxCharsPerFile,
          excludeUntracked,
          untrackedPaths
        )
      : files;

  const omittedFileCount = Math.max(0, changedRows.length - files.length);

  return {
    connectionId: '',
    branch,
    harborSubdir,
    changedFileCount: changedRows.length,
    files: collapsedFiles,
    truncated: truncated || omittedFileCount > 0,
    omittedFileCount
  };
}
