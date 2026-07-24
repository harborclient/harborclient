import { describe, expect, it } from 'vitest';
import type { GitRequestFileStatus } from '#/shared/types';
import { countUntrackedCollectionItems } from './countUntrackedCollectionItems';

/**
 * Builds a minimal per-item git status for tests.
 *
 * @param isUntracked - Whether the item is untracked.
 */
function status(isUntracked: boolean): GitRequestFileStatus {
  return {
    displayStatus: isUntracked ? 'unstaged' : 'staged',
    canAdd: isUntracked,
    canRemove: !isUntracked,
    isUntracked
  };
}

describe('countUntrackedCollectionItems', () => {
  it('returns 0 when the collection has no untracked items', () => {
    expect(
      countUntrackedCollectionItems([{ uuid: 'req-1' }], [{ uuid: 'doc-1' }], {
        'req-1': status(false),
        'doc-1': status(false)
      })
    ).toBe(0);
  });

  it('counts untracked requests and documents', () => {
    expect(
      countUntrackedCollectionItems([{ uuid: 'req-1' }, { uuid: 'req-2' }], [{ uuid: 'doc-1' }], {
        'req-1': status(true),
        'req-2': status(false),
        'doc-1': status(true)
      })
    ).toBe(2);
  });

  it('ignores items with no status entry', () => {
    expect(
      countUntrackedCollectionItems([{ uuid: 'req-clean' }], [{ uuid: 'doc-clean' }], {})
    ).toBe(0);
  });
});
