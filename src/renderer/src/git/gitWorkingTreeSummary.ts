import type { SourceControlStatus } from '#/shared/types';

/**
 * Builds the working-tree summary line shown above changed files in the Git sidebar.
 *
 * @param status - Current source-control status for the active connection.
 * @param gitAutoAdd - Whether HarborClient auto-tracks changes before commit.
 */
export function buildGitWorkingTreeSummary(
  status: SourceControlStatus,
  gitAutoAdd: boolean
): string {
  const parts = [`${status.changedCount} uncommitted change(s)`];

  if (!gitAutoAdd) {
    parts.push(`${status.stagedCount} staged`);
  }

  if (status.conflictCount > 0) {
    parts.push(`${status.conflictCount} conflict(s)`);
  }

  return parts.join(' · ');
}
