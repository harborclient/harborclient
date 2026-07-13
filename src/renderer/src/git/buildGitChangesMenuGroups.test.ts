import { describe, expect, it, vi } from 'vitest';
import { buildGitChangesMenuGroups } from '#/renderer/src/git/buildGitChangesMenuGroups';

describe('buildGitChangesMenuGroups', () => {
  it('returns Add, Remove, and Revert when both stage actions are available', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const onRevert = vi.fn();

    const groups = buildGitChangesMenuGroups(
      {
        displayStatus: 'uncommitted',
        canAdd: true,
        canRemove: true
      },
      onAdd,
      onRemove,
      onRevert
    );

    expect(groups).toHaveLength(1);
    const submenu = groups[0]?.[0]?.submenu?.[0] ?? [];
    expect(submenu.map((item) => item.label)).toEqual(['Add', 'Remove', 'Revert changes']);
  });

  it('returns no groups for clean requests', () => {
    expect(
      buildGitChangesMenuGroups(
        { displayStatus: 'clean', canAdd: false, canRemove: false },
        vi.fn(),
        vi.fn(),
        vi.fn()
      )
    ).toEqual([]);
  });

  it('includes Revert changes for staged-only requests', () => {
    const groups = buildGitChangesMenuGroups(
      {
        displayStatus: 'staged',
        canAdd: false,
        canRemove: true
      },
      vi.fn(),
      vi.fn(),
      vi.fn()
    );

    const submenu = groups[0]?.[0]?.submenu?.[0] ?? [];
    expect(submenu.map((item) => item.label)).toEqual(['Remove', 'Revert changes']);
  });
});
