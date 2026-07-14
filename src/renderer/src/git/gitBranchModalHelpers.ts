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
 * Returns whether a branch row in the merge modal should be disabled.
 *
 * Unlike switching, merging is allowed while the working tree has uncommitted changes.
 *
 * @param args - Current branch, target branch, and busy state.
 */
export function isBranchMergeDisabled(args: {
  currentBranch: string | null;
  targetBranch: string;
  busy: boolean;
}): boolean {
  return args.busy || args.targetBranch === args.currentBranch;
}

/**
 * Returns whether a branch row delete action should be disabled.
 *
 * The currently checked-out branch cannot be deleted.
 *
 * @param args - Current branch, target branch, and busy state.
 */
export function isBranchDeleteDisabled(args: {
  currentBranch: string | null;
  targetBranch: string;
  busy: boolean;
}): boolean {
  return args.busy || args.targetBranch === args.currentBranch;
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

/**
 * Returns whether a branch name already exists in the local branch list.
 *
 * @param branches - Local branch names from the repository.
 * @param name - Branch name to look up (exact, case-sensitive match).
 */
export function branchExists(branches: string[], name: string): boolean {
  return branches.includes(name);
}

/**
 * Filters local branch names by a case-insensitive substring match.
 *
 * @param branches - Local branch names from the repository.
 * @param query - Search text from the branch picker input.
 */
export function filterBranches(branches: string[], query: string): string[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return branches;
  }

  const needle = trimmed.toLowerCase();
  return branches.filter((branch) => branch.toLowerCase().includes(needle));
}

/**
 * Returns whether the branch picker can create a new branch from the current query.
 *
 * @param query - Search or draft branch name from the picker input.
 * @param branches - Local branch names from the repository.
 * @param busy - Whether a branch operation is in flight.
 */
export function canCreateBranchFromQuery(
  query: string,
  branches: string[],
  busy: boolean
): boolean {
  const trimmed = query.trim();
  return canCreateGitBranch(trimmed, busy) && !branchExists(branches, trimmed);
}
