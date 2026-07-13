import { describe, expect, it } from 'vitest';
import {
  buildGitCommitFileAccessibleName,
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
    expect(buildGitCommitFileAccessibleName('.harborclient/collection.json', 'modified')).toBe(
      '.harborclient/collection.json, modified in commit'
    );
  });
});
