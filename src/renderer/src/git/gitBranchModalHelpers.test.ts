import { describe, expect, it } from 'vitest';
import {
  canCreateGitBranch,
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

  it('requires a non-empty branch name before create can run', () => {
    expect(canCreateGitBranch('feature', false)).toBe(true);
    expect(canCreateGitBranch('   ', false)).toBe(false);
    expect(canCreateGitBranch('feature', true)).toBe(false);
  });
});
