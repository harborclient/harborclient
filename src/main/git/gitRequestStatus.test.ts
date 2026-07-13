import { describe, expect, it } from 'vitest';
import {
  analyzeMatrixRow,
  countStagedAndUnstaged,
  hasStagedChanges
} from '#/main/git/gitRequestStatus';

describe('git request status helpers', () => {
  it('detects staged and unstaged changes from matrix rows', () => {
    const flags = analyzeMatrixRow(['collections/foo/collection.json', 1, 2, 2]);
    expect(flags).toEqual({
      hasStagedChanges: true,
      hasUnstagedChanges: false,
      isUntracked: false
    });
  });

  it('counts changed files in a status matrix', () => {
    const matrix: Array<[string, number, number, number]> = [
      ['file-a.json', 1, 2, 2],
      ['file-b.json', 1, 1, 1],
      ['file-c.json', 0, 2, 0]
    ];

    expect(countStagedAndUnstaged(matrix)).toEqual({
      stagedCount: 1,
      unstagedCount: 1,
      changedCount: 2
    });
    expect(hasStagedChanges(matrix)).toBe(true);
  });
});
