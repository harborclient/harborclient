import { describe, expect, it } from 'vitest';
import {
  buildGitCommitFileAccessibleName,
  gitCommitChangeAccessibleLabel,
  gitCommitChangeNameClass,
  gitResourceKindLabel,
  resolveGitChangeDisplayLabel
} from '#/renderer/src/git/gitCommitChangeDisplay';

describe('gitCommitChangeDisplay', () => {
  it('maps commit statuses to name classes', () => {
    expect(gitCommitChangeNameClass('added')).toBe('text-git-unstaged');
    expect(gitCommitChangeNameClass('modified')).toBe('text-git-uncommitted');
    expect(gitCommitChangeNameClass('deleted')).toBe('text-muted line-through');
  });

  it('builds accessible labels and names', () => {
    expect(gitCommitChangeAccessibleLabel('added')).toBe('added in commit');
    expect(
      buildGitCommitFileAccessibleName('.harborclient/collection-api/req-health.json', 'modified')
    ).toBe('.harborclient/collection-api/req-health.json, modified in commit');
    expect(
      buildGitCommitFileAccessibleName(
        '.harborclient/collection-api/req-health.json',
        'modified',
        'Health Check',
        'request'
      )
    ).toBe('Health Check, request, modified in commit');
  });

  it('resolves display labels and resource kind badges', () => {
    expect(resolveGitChangeDisplayLabel('path/req-health.json', 'Health Check')).toBe(
      'Health Check'
    );
    expect(gitResourceKindLabel('document')).toBe('document');
  });
});
