import { describe, expect, it } from 'vitest';
import { FOLDER_SETTINGS_DEFAULTS } from '@harborclient/core/testFixtures/folder';
import type { Folder } from '@harborclient/core/types';
import { resolveRunnerTargetNames } from './resolveRunnerTargetName';

/**
 * Builds a folder fixture for runner target label tests.
 *
 * @param id - Folder database id.
 * @param name - Folder display name.
 * @param parentFolderId - Parent folder id, or null for a root folder.
 * @returns Folder row with default scoped settings.
 */
function folderFixture(id: number, name: string, parentFolderId: number | null): Folder {
  return {
    id,
    uuid: `folder-${id}`,
    collection_id: 1,
    name,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...FOLDER_SETTINGS_DEFAULTS,
    parent_folder_id: parentFolderId
  };
}

describe('resolveRunnerTargetNames', () => {
  it('uses the full path for a nested folder target', () => {
    const folders = [folderFixture(10, 'Auth', null), folderFixture(11, 'Users', 10)];

    expect(
      resolveRunnerTargetNames(
        { collectionId: 1, folderId: 11 },
        [{ id: 1, name: 'API' }],
        folders,
        []
      )
    ).toEqual({
      collectionName: 'API',
      folderName: 'Auth / Users',
      requestName: null
    });
  });
});
