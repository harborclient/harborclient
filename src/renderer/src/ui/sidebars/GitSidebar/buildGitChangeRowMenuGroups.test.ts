import { describe, expect, it, vi } from 'vitest';
import { buildGitChangeRowMenuGroups } from '#/renderer/src/ui/sidebars/GitSidebar/buildGitChangeRowMenuGroups';

describe('buildGitChangeRowMenuGroups', () => {
  it('returns a single Revert changes danger action', () => {
    const onRevert = vi.fn();
    const groups = buildGitChangeRowMenuGroups(onRevert);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
    expect(groups[0][0]).toMatchObject({
      label: 'Revert changes',
      variant: 'danger'
    });

    groups[0][0]?.onSelect?.();
    expect(onRevert).toHaveBeenCalledOnce();
  });
});
