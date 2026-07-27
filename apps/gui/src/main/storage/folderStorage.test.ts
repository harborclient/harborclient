import { describe, expect, it } from 'vitest';
import type { ExportedFolder } from '@harborclient/core/types';
import { sortExportedFoldersParentFirst } from './folderStorage';

/**
 * Builds a minimal exported folder row for sorter tests.
 *
 * @param overrides - Fields to merge onto the default root folder.
 * @returns Exported folder payload.
 */
function exportedFolder(
  overrides: Partial<ExportedFolder> & Pick<ExportedFolder, 'name'>
): ExportedFolder {
  return {
    sort_order: 0,
    ...overrides
  };
}

describe('sortExportedFoldersParentFirst', () => {
  it('keeps legacy folders that omit uuid', () => {
    const folders = [
      exportedFolder({ name: 'Alpha', sort_order: 0 }),
      exportedFolder({ name: 'Beta', sort_order: 1 })
    ];

    expect(sortExportedFoldersParentFirst(folders).map((folder) => folder.name)).toEqual([
      'Alpha',
      'Beta'
    ]);
  });

  it('orders uuid folders so parents appear before children', () => {
    const folders = [
      exportedFolder({
        name: 'Child',
        uuid: 'child',
        parent_folder_uuid: 'parent',
        sort_order: 0
      }),
      exportedFolder({ name: 'Parent', uuid: 'parent', sort_order: 0 })
    ];

    expect(sortExportedFoldersParentFirst(folders).map((folder) => folder.name)).toEqual([
      'Parent',
      'Child'
    ]);
  });

  it('preserves uuid-less folders alongside parent-ordered uuid folders', () => {
    const folders = [
      exportedFolder({
        name: 'Child',
        uuid: 'child',
        parent_folder_uuid: 'parent',
        sort_order: 0
      }),
      exportedFolder({ name: 'Legacy', sort_order: 1 }),
      exportedFolder({ name: 'Parent', uuid: 'parent', sort_order: 0 })
    ];

    expect(sortExportedFoldersParentFirst(folders).map((folder) => folder.name)).toEqual([
      'Parent',
      'Child',
      'Legacy'
    ]);
  });
});
