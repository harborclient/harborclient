import { describe, expect, it } from 'vitest';
import {
  buildGitRequestAccessibleName,
  gitRequestNameClass,
  gitRequestStatusAccessibleLabel
} from '#/renderer/src/git/gitRequestDisplay';

describe('gitRequestDisplay', () => {
  it('maps display statuses to text classes', () => {
    expect(gitRequestNameClass('staged')).toBe('text-git-staged');
    expect(gitRequestNameClass('uncommitted')).toBe('text-git-uncommitted');
    expect(gitRequestNameClass('unstaged')).toBe('text-git-unstaged');
    expect(gitRequestNameClass('clean')).toBe('');
  });

  it('builds accessible names with git status suffixes', () => {
    expect(gitRequestStatusAccessibleLabel('staged')).toBe('staged for commit');
    expect(buildGitRequestAccessibleName('Get users', 'unstaged')).toBe(
      'Get users, not added to git'
    );
    expect(buildGitRequestAccessibleName('Get users', 'clean')).toBe('Get users');
  });
});
