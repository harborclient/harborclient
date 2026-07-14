import * as git from 'isomorphic-git';
import fs from 'fs';
import type { GitRequestFileStatus } from '#/shared/types';

/**
 * One isomorphic-git statusMatrix row: filepath, HEAD, workdir, stage.
 */
export type GitMatrixRow = [string, number, number, number];

/**
 * Added, modified, or deleted relative to HEAD for one matrix comparison axis.
 */
export type GitMatrixChangeStatus = 'added' | 'modified' | 'deleted';

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

  /**
   * Change type comparing HEAD to the working tree, or null when they match.
   */
  workdirChangeStatus: GitMatrixChangeStatus | null;

  /**
   * Change type comparing HEAD to the index, or null when they match.
   */
  stagedChangeStatus: GitMatrixChangeStatus | null;
}

/**
 * Derives a working-tree change label from HEAD and workdir stage flags.
 *
 * @param head - HEAD stage flag (0 absent, 1 present).
 * @param workdir - Workdir stage flag (0 absent, 1 same, 2 different).
 */
function deriveWorkdirChangeStatus(head: number, workdir: number): GitMatrixChangeStatus | null {
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
 * Derives a staged change label from HEAD and index stage flags.
 *
 * @param head - HEAD stage flag (0 absent, 1 present).
 * @param stage - Index stage flag (0 absent, 1 present).
 */
function deriveStagedChangeStatus(head: number, stage: number): GitMatrixChangeStatus | null {
  if (head === 0 && stage !== 0) {
    return 'added';
  }
  if (head !== 0 && stage === 0) {
    return 'deleted';
  }
  if (head !== 0 && stage !== 0 && head !== stage) {
    return 'modified';
  }
  return null;
}

/**
 * Returns whether a changed file should count toward collection change totals.
 *
 * Tracked files that differ from HEAD (staged and/or unstaged) count; untracked
 * files do not until Auto track or manual staging adds them to the index.
 *
 * @param flags - Change flags from {@link analyzeMatrixRow}.
 */
export function isCountedCollectionChange(flags: GitRequestRowFlags): boolean {
  return !flags.isUntracked;
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
    isUntracked,
    workdirChangeStatus: deriveWorkdirChangeStatus(head, workdir),
    stagedChangeStatus: deriveStagedChangeStatus(head, stage)
  };
}

/**
 * Maps per-file git flags to sidebar display state and context-menu affordances.
 *
 * @param flags - Change flags from {@link analyzeMatrixRow}, or null when clean.
 * @returns Per-item git status for collection sidebar menus and labels.
 */
export function deriveRequestFileStatus(flags: GitRequestRowFlags | null): GitRequestFileStatus {
  if (flags == null) {
    return {
      displayStatus: 'clean',
      canAdd: false,
      canRemove: false,
      isUntracked: false
    };
  }

  const canAdd = flags.hasUnstagedChanges || flags.isUntracked;
  const canRemove = flags.hasStagedChanges;

  let displayStatus: GitRequestFileStatus['displayStatus'];
  if (canRemove && canAdd) {
    displayStatus = 'uncommitted';
  } else if (canRemove) {
    displayStatus = 'staged';
  } else {
    displayStatus = 'unstaged';
  }

  return {
    displayStatus,
    canAdd,
    canRemove,
    isUntracked: flags.isUntracked
  };
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

    if (flags.isUntracked) {
      continue;
    }

    changedCount += 1;
    if (flags.hasStagedChanges) {
      stagedCount += 1;
    }
    if (flags.hasUnstagedChanges) {
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
