import { describe, expect, it } from 'vitest';
import type { Workspace } from '@harborclient/core/types/workspace';
import { parseWorkspaceDragId, workspaceDragId, workspaceSummaryText } from './utils';

describe('workspaceSummaryText', () => {
  it('formats singular and plural request counts', () => {
    const oneRequest: Workspace = {
      id: 1,
      name: 'Auth',
      requests: [{ requestUuid: 'uuid-1' }],
      createdAt: 1,
      updatedAt: 1
    };
    const twoRequests: Workspace = {
      id: 2,
      name: 'Users',
      requests: [{ requestUuid: 'uuid-1' }, { requestUuid: 'uuid-2' }],
      createdAt: 1,
      updatedAt: 1
    };

    expect(workspaceSummaryText(oneRequest)).toBe('1 request');
    expect(workspaceSummaryText(twoRequests)).toBe('2 requests');
  });
});

describe('workspaceDragId', () => {
  it('builds and parses stable drag ids', () => {
    expect(workspaceDragId(42)).toBe('tab-group:42');
    expect(parseWorkspaceDragId('tab-group:42')).toBe(42);
    expect(parseWorkspaceDragId('environment:42')).toBeNull();
  });
});
