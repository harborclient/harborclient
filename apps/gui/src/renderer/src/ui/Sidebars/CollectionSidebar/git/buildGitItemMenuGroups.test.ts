import { describe, expect, it, vi } from 'vitest';
import type { GitRequestFileStatus } from '#/shared/types';
import { buildGitItemMenuGroups } from './buildGitItemMenuGroups';

describe('buildGitItemMenuGroups', () => {
  const onStageItem = vi.fn();
  const onUnstageItem = vi.fn();

  it('returns an empty array when the collection is not git-backed', () => {
    expect(buildGitItemMenuGroups(false, undefined, onStageItem, onUnstageItem)).toEqual([]);
  });

  it('shows Add when the item is untracked', () => {
    const status: GitRequestFileStatus = {
      displayStatus: 'unstaged',
      canAdd: true,
      canRemove: false,
      isUntracked: true
    };

    const groups = buildGitItemMenuGroups(true, status, onStageItem, onUnstageItem);

    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toMatchObject({ label: 'Git' });
    expect(groups[0][0].submenu?.[0]).toEqual([{ label: 'Add', onSelect: onStageItem }]);
  });

  it('shows Remove when the item is tracked with staged changes', () => {
    const status: GitRequestFileStatus = {
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true,
      isUntracked: false
    };

    const groups = buildGitItemMenuGroups(true, status, onStageItem, onUnstageItem);

    expect(groups[0][0].submenu?.[0]).toEqual([{ label: 'Remove', onSelect: onUnstageItem }]);
  });

  it('shows Remove when the item is clean and tracked', () => {
    const groups = buildGitItemMenuGroups(true, undefined, onStageItem, onUnstageItem);

    expect(groups[0][0].submenu?.[0]).toEqual([{ label: 'Remove', onSelect: onUnstageItem }]);
  });
});
