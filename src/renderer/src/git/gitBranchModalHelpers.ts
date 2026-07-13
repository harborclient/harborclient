/**
 * Returns whether branch switching should be blocked due to uncommitted changes.
 *
 * @param changedCount - Number of uncommitted changes in the HarborClient tree.
 */
export function shouldBlockBranchSwitch(changedCount: number): boolean {
  return changedCount > 0;
}

/**
 * Returns whether a branch row in the switch modal should be disabled.
 *
 * @param args - Current branch, target branch, busy state, and uncommitted change count.
 */
export function isBranchSwitchDisabled(args: {
  currentBranch: string | null;
  targetBranch: string;
  busy: boolean;
  changedCount: number;
}): boolean {
  return (
    args.busy ||
    args.targetBranch === args.currentBranch ||
    shouldBlockBranchSwitch(args.changedCount)
  );
}

/**
 * Returns whether the create-branch action can run for the current draft name.
 *
 * @param name - Draft branch name from the input field.
 * @param busy - Whether a create request is in flight.
 */
export function canCreateGitBranch(name: string, busy: boolean): boolean {
  return !busy && name.trim().length > 0;
}
