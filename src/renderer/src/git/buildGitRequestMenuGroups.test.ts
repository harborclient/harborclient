import { describe, expect, it } from 'vitest';
import { buildGitRequestMenuGroups } from '#/renderer/src/git/buildGitRequestMenuGroups';

describe('buildGitRequestMenuGroups', () => {
  it('returns Add and Remove when both actions are available', () => {
    const groups = buildGitRequestMenuGroups(
      {
        displayStatus: 'uncommitted',
        canAdd: true,
        canRemove: true
      },
      () => undefined,
      () => undefined
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.[0]?.label).toBe('Git');
    const submenu = groups[0]?.[0]?.submenu?.[0] ?? [];
    expect(submenu.map((item) => item.label)).toEqual(['Add', 'Remove']);
  });

  it('returns no groups for clean requests', () => {
    expect(
      buildGitRequestMenuGroups(
        { displayStatus: 'clean', canAdd: false, canRemove: false },
        () => undefined,
        () => undefined
      )
    ).toEqual([]);
  });
});
