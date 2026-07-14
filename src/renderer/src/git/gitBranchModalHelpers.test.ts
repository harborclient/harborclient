import { describe, expect, it } from 'vitest';
import {
  branchExists,
  canCreateBranchFromQuery,
  canCreateGitBranch,
  filterBranches,
  isBranchDeleteDisabled,
  isBranchMergeDisabled,
  isBranchSwitchDisabled,
  shouldBlockBranchSwitch
} from '#/renderer/src/git/gitBranchModalHelpers';

describe('gitBranchModalHelpers', () => {
  it('blocks branch switching when there are uncommitted changes', () => {
    expect(shouldBlockBranchSwitch(1)).toBe(true);
    expect(shouldBlockBranchSwitch(0)).toBe(false);
  });

  it('disables non-current branches while the working tree is dirty', () => {
    expect(
      isBranchSwitchDisabled({
        currentBranch: 'main',
        targetBranch: 'feature',
        busy: false,
        changedCount: 2
      })
    ).toBe(true);
  });

  it('disables the current branch row even when the working tree is clean', () => {
    expect(
      isBranchSwitchDisabled({
        currentBranch: 'main',
        targetBranch: 'main',
        busy: false,
        changedCount: 0
      })
    ).toBe(true);
  });

  it('allows switching to another branch when clean and not busy', () => {
    expect(
      isBranchSwitchDisabled({
        currentBranch: 'main',
        targetBranch: 'feature',
        busy: false,
        changedCount: 0
      })
    ).toBe(false);
  });

  it('disables merge when busy', () => {
    expect(
      isBranchMergeDisabled({
        currentBranch: 'main',
        targetBranch: 'feature',
        busy: true
      })
    ).toBe(true);
  });

  it('disables merging the current branch into itself', () => {
    expect(
      isBranchMergeDisabled({
        currentBranch: 'main',
        targetBranch: 'main',
        busy: false
      })
    ).toBe(true);
  });

  it('allows merging another branch even when the working tree is dirty', () => {
    expect(
      isBranchMergeDisabled({
        currentBranch: 'main',
        targetBranch: 'feature',
        busy: false
      })
    ).toBe(false);
  });

  it('disables delete when busy', () => {
    expect(
      isBranchDeleteDisabled({
        currentBranch: 'main',
        targetBranch: 'feature',
        busy: true
      })
    ).toBe(true);
  });

  it('disables deleting the currently checked-out branch', () => {
    expect(
      isBranchDeleteDisabled({
        currentBranch: 'main',
        targetBranch: 'main',
        busy: false
      })
    ).toBe(true);
  });

  it('allows deleting another branch when not busy', () => {
    expect(
      isBranchDeleteDisabled({
        currentBranch: 'main',
        targetBranch: 'feature',
        busy: false
      })
    ).toBe(false);
  });

  it('requires a non-empty branch name before create can run', () => {
    expect(canCreateGitBranch('feature', false)).toBe(true);
    expect(canCreateGitBranch('   ', false)).toBe(false);
    expect(canCreateGitBranch('feature', true)).toBe(false);
  });

  it('detects exact branch name matches', () => {
    expect(branchExists(['main', 'feature'], 'main')).toBe(true);
    expect(branchExists(['main', 'feature'], 'Main')).toBe(false);
    expect(branchExists(['main', 'feature'], 'other')).toBe(false);
  });

  it('filters branches by case-insensitive substring', () => {
    expect(filterBranches(['main', 'feature/foo', 'autocomplete'], 'feat')).toEqual([
      'feature/foo'
    ]);
    expect(filterBranches(['main', 'feature'], '')).toEqual(['main', 'feature']);
    expect(filterBranches(['main', 'feature'], '   ')).toEqual(['main', 'feature']);
  });

  it('allows create only when the query is new and non-empty', () => {
    expect(canCreateBranchFromQuery('new-branch', ['main'], false)).toBe(true);
    expect(canCreateBranchFromQuery('main', ['main'], false)).toBe(false);
    expect(canCreateBranchFromQuery('   ', ['main'], false)).toBe(false);
    expect(canCreateBranchFromQuery('new-branch', ['main'], true)).toBe(false);
  });
});
