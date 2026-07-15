import { describe, expect, it } from 'vitest';
import { buildGitWorkingTreeSummary } from './gitWorkingTreeSummary';
import type { SourceControlStatus } from '#/shared/types';

const baseStatus: SourceControlStatus = {
  branch: 'main',
  changedCount: 6,
  stagedCount: 1,
  unstagedCount: 5,
  ahead: 0,
  behind: 0,
  syncKnown: true,
  harborRootExists: true,
  harborSubdir: '.harborclient',
  conflictCount: 0
};

describe('buildGitWorkingTreeSummary', () => {
  it('includes staged count when auto track is disabled', () => {
    expect(buildGitWorkingTreeSummary(baseStatus, false)).toBe(
      '6 uncommitted change(s) · 1 staged'
    );
  });

  it('omits staged count when auto track is enabled', () => {
    expect(buildGitWorkingTreeSummary(baseStatus, true)).toBe('6 uncommitted change(s)');
  });

  it('includes conflict count when present', () => {
    expect(buildGitWorkingTreeSummary({ ...baseStatus, conflictCount: 2 }, false)).toBe(
      '6 uncommitted change(s) · 1 staged · 2 conflict(s)'
    );
  });
});
