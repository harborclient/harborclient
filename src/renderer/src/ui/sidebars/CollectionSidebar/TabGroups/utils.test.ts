import { describe, expect, it } from 'vitest';
import type { TabGroup } from '#/shared/types/tabGroup';
import {
  parseTabGroupDragId,
  tabGroupDragId,
  tabGroupSummaryText
} from '#/renderer/src/ui/sidebars/CollectionSidebar/TabGroups/utils';

describe('tabGroupSummaryText', () => {
  it('formats singular and plural request counts', () => {
    const oneRequest: TabGroup = {
      id: 1,
      name: 'Auth',
      requests: [{ requestUuid: 'uuid-1' }],
      createdAt: 1,
      updatedAt: 1
    };
    const twoRequests: TabGroup = {
      id: 2,
      name: 'Users',
      requests: [{ requestUuid: 'uuid-1' }, { requestUuid: 'uuid-2' }],
      createdAt: 1,
      updatedAt: 1
    };

    expect(tabGroupSummaryText(oneRequest)).toBe('1 request');
    expect(tabGroupSummaryText(twoRequests)).toBe('2 requests');
  });
});

describe('tabGroupDragId', () => {
  it('builds and parses stable drag ids', () => {
    expect(tabGroupDragId(42)).toBe('tab-group:42');
    expect(parseTabGroupDragId('tab-group:42')).toBe(42);
    expect(parseTabGroupDragId('environment:42')).toBeNull();
  });
});
