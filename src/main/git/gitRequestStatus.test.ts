import { describe, expect, it } from 'vitest';
import {
  analyzeMatrixRow,
  countStagedAndUnstaged,
  deriveRequestFileStatus,
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
      ['file-c.json', 0, 2, 0],
      ['file-d.json', 1, 2, 1]
    ];

    expect(countStagedAndUnstaged(matrix)).toEqual({
      stagedCount: 1,
      unstagedCount: 1,
      changedCount: 2
    });
    expect(hasStagedChanges(matrix)).toBe(true);
  });

  it('derives clean status when matrix row has no changes', () => {
    expect(deriveRequestFileStatus(null)).toEqual({
      displayStatus: 'clean',
      canAdd: false,
      canRemove: false,
      isUntracked: false
    });
  });

  it('derives unstaged add-only status for untracked files', () => {
    const flags = analyzeMatrixRow(['.harborclient/collection-api/req-get.json', 0, 2, 0]);
    expect(deriveRequestFileStatus(flags)).toEqual({
      displayStatus: 'unstaged',
      canAdd: true,
      canRemove: false,
      isUntracked: true
    });
  });

  it('derives staged remove-only status for staged-only changes', () => {
    const flags = analyzeMatrixRow(['.harborclient/collection-api/req-get.json', 1, 2, 2]);
    expect(deriveRequestFileStatus(flags)).toEqual({
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true,
      isUntracked: false
    });
  });

  it('derives uncommitted status when staged and unstaged changes coexist', () => {
    const flags = {
      hasStagedChanges: true,
      hasUnstagedChanges: true,
      isUntracked: false
    };
    expect(deriveRequestFileStatus(flags)).toEqual({
      displayStatus: 'uncommitted',
      canAdd: true,
      canRemove: true,
      isUntracked: false
    });
  });
});
