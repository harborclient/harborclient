import { describe, expect, it } from 'vitest';
import {
  analyzeMatrixRow,
  countStagedAndUnstaged,
  deriveRequestFileStatus,
  hasStagedChanges,
  type GitMatrixRow,
  type GitRequestRowFlags
} from '#/main/git/gitRequestStatus';

describe('git request status helpers', () => {
  it('detects staged and unstaged changes from matrix rows', () => {
    const flags = analyzeMatrixRow(['collections/foo/collection.json', 1, 2, 2]);
    expect(flags).toEqual({
      hasStagedChanges: true,
      hasUnstagedChanges: false,
      isUntracked: false,
      workdirChangeStatus: 'modified',
      stagedChangeStatus: 'modified'
    });
  });

  it('returns null for clean matrix rows', () => {
    expect(analyzeMatrixRow(['file.json', 1, 1, 1])).toBeNull();
  });

  it.each<[GitMatrixRow, Pick<GitRequestRowFlags, 'workdirChangeStatus' | 'stagedChangeStatus'>]>([
    [['added-untracked.json', 0, 2, 0], { workdirChangeStatus: 'added', stagedChangeStatus: null }],
    [['added-staged.json', 0, 2, 1], { workdirChangeStatus: 'added', stagedChangeStatus: 'added' }],
    [
      ['deleted-workdir.json', 1, 0, 1],
      { workdirChangeStatus: 'deleted', stagedChangeStatus: null }
    ],
    [
      ['deleted-staged.json', 1, 1, 0],
      { workdirChangeStatus: null, stagedChangeStatus: 'deleted' }
    ],
    [
      ['modified-workdir.json', 1, 2, 1],
      { workdirChangeStatus: 'modified', stagedChangeStatus: null }
    ],
    [
      ['modified-staged-only.json', 1, 1, 2],
      { workdirChangeStatus: null, stagedChangeStatus: 'modified' }
    ],
    [
      ['modified-both.json', 1, 2, 2],
      { workdirChangeStatus: 'modified', stagedChangeStatus: 'modified' }
    ]
  ])('derives workdir and staged change labels for %s', (row, expectedStatuses) => {
    const flags = analyzeMatrixRow(row);
    expect(flags).not.toBeNull();
    expect(flags?.workdirChangeStatus).toBe(expectedStatuses.workdirChangeStatus);
    expect(flags?.stagedChangeStatus).toBe(expectedStatuses.stagedChangeStatus);
  });

  it('marks untracked files with added workdir status and no staged status', () => {
    const flags = analyzeMatrixRow(['new.json', 0, 2, 0]);
    expect(flags).toMatchObject({
      isUntracked: true,
      hasStagedChanges: false,
      hasUnstagedChanges: true,
      workdirChangeStatus: 'added',
      stagedChangeStatus: null
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
    const flags: GitRequestRowFlags = {
      hasStagedChanges: true,
      hasUnstagedChanges: true,
      isUntracked: false,
      workdirChangeStatus: 'modified',
      stagedChangeStatus: 'modified'
    };
    expect(deriveRequestFileStatus(flags)).toEqual({
      displayStatus: 'uncommitted',
      canAdd: true,
      canRemove: true,
      isUntracked: false
    });
  });
});
