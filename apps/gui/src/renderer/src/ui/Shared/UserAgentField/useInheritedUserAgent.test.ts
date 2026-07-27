import { describe, expect, it } from 'vitest';
import { FOLDER_SETTINGS_DEFAULTS } from '@harborclient/core/testFixtures/folder';
import type { Folder } from '@harborclient/core/types';
import { resolveInheritedFolderUserAgent } from './useInheritedUserAgent';

/**
 * Builds a nested folder fixture with an optional User-Agent override.
 *
 * @param id - Folder database id.
 * @param parentFolderId - Parent folder id, or null at collection root.
 * @param userAgent - Folder-level override.
 * @returns Folder row for inheritance tests.
 */
function folderFixture(id: number, parentFolderId: number | null, userAgent = ''): Folder {
  return {
    id,
    uuid: `folder-${id}`,
    collection_id: 1,
    name: `Folder ${id}`,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...FOLDER_SETTINGS_DEFAULTS,
    parent_folder_id: parentFolderId,
    userAgent
  };
}

describe('resolveInheritedFolderUserAgent', () => {
  it('uses the nearest configured ancestor when the current folder is empty', () => {
    const folders = [
      folderFixture(1, null, 'root-agent'),
      folderFixture(2, 1, 'parent-agent'),
      folderFixture(3, 2)
    ];

    expect(resolveInheritedFolderUserAgent(3, folders)).toBe('parent-agent');
  });

  it('prefers the current folder override over its ancestors', () => {
    const folders = [folderFixture(1, null, 'root-agent'), folderFixture(2, 1, 'child-agent')];

    expect(resolveInheritedFolderUserAgent(2, folders)).toBe('child-agent');
  });
});
