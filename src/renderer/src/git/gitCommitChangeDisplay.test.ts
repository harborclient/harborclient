import { describe, expect, it } from 'vitest';
import {
  buildGitCommitFileAccessibleName,
  buildGitItemAccessibleName,
  gitChangeStatusMarker,
  gitChangeStatusMarkerLabel,
  gitCommitChangeAccessibleLabel,
  gitCommitChangeNameClass,
  gitItemAccessibleSuffix,
  gitItemNameClass,
  gitResourceKindLabel,
  resolveGitChangeDisplayLabel
} from './gitCommitChangeDisplay';

describe('gitCommitChangeDisplay', () => {
  it('maps commit statuses to name classes', () => {
    expect(gitCommitChangeNameClass('added')).toBe('text-git-unstaged');
    expect(gitCommitChangeNameClass('modified')).toBe('text-git-uncommitted');
    expect(gitCommitChangeNameClass('deleted')).toBe('text-muted line-through');
  });

  it('maps working-tree statuses to compact markers', () => {
    expect(gitChangeStatusMarker('added', false)).toBe('A');
    expect(gitChangeStatusMarker('modified', false)).toBe('M');
    expect(gitChangeStatusMarker('deleted', false)).toBe('D');
    expect(gitChangeStatusMarker('modified', true)).toBe('C');
    expect(gitChangeStatusMarkerLabel('added', false)).toBe('Added');
    expect(gitChangeStatusMarkerLabel('modified', false)).toBe('Modified');
    expect(gitChangeStatusMarkerLabel('deleted', false)).toBe('Deleted');
    expect(gitChangeStatusMarkerLabel('modified', true)).toBe('Conflict');
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
    expect(gitResourceKindLabel('collection')).toBe('collection');
  });

  it('maps collection item git status to muted name classes', () => {
    expect(gitItemNameClass(undefined)).toBe('');
    expect(
      gitItemNameClass({
        displayStatus: 'clean',
        canAdd: false,
        canRemove: false,
        isUntracked: false
      })
    ).toBe('');
    expect(
      gitItemNameClass({
        displayStatus: 'staged',
        canAdd: false,
        canRemove: true,
        isUntracked: false
      })
    ).toBe('text-git-staged');
    expect(
      gitItemNameClass({
        displayStatus: 'uncommitted',
        canAdd: true,
        canRemove: true,
        isUntracked: false
      })
    ).toBe('text-git-uncommitted');
    expect(
      gitItemNameClass({
        displayStatus: 'unstaged',
        canAdd: true,
        canRemove: false,
        isUntracked: false
      })
    ).toBe('text-git-unstaged');
    expect(
      gitItemNameClass({
        displayStatus: 'unstaged',
        canAdd: true,
        canRemove: false,
        isUntracked: true
      })
    ).toBe('text-git-untracked');
  });

  it('builds accessible labels for untracked collection items', () => {
    expect(gitItemAccessibleSuffix(undefined)).toBeNull();
    expect(
      gitItemAccessibleSuffix({
        displayStatus: 'unstaged',
        canAdd: true,
        canRemove: false,
        isUntracked: true
      })
    ).toBe('not added to git');
    expect(
      gitItemAccessibleSuffix({
        displayStatus: 'unstaged',
        canAdd: true,
        canRemove: false,
        isUntracked: false
      })
    ).toBeNull();
    expect(buildGitItemAccessibleName('README', undefined)).toBe('README');
    expect(
      buildGitItemAccessibleName('README', {
        displayStatus: 'unstaged',
        canAdd: true,
        canRemove: false,
        isUntracked: true
      })
    ).toBe('README, not added to git');
  });
});
