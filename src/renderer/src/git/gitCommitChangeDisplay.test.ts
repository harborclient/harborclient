import { describe, expect, it } from 'vitest';
import {
  buildGitCommitResourceAccessibleName,
  gitCommitChangeAccessibleLabel,
  gitCommitChangeNameClass
} from '#/renderer/src/git/gitCommitChangeDisplay';

describe('gitCommitChangeDisplay', () => {
  it('maps commit statuses to name classes', () => {
    expect(gitCommitChangeNameClass('added')).toBe('text-git-unstaged');
    expect(gitCommitChangeNameClass('modified')).toBe('text-git-uncommitted');
    expect(gitCommitChangeNameClass('deleted')).toBe('text-muted line-through');
  });

  it('builds accessible labels and names', () => {
    expect(gitCommitChangeAccessibleLabel('added')).toBe('added in commit');
    expect(buildGitCommitResourceAccessibleName('Echo', 'modified')).toBe(
      'Echo, modified in commit'
    );
  });
});
