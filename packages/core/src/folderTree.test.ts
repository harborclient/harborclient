import { describe, expect, it } from 'vitest';
import { FOLDER_SETTINGS_DEFAULTS } from './testFixtures/folder';
import {
  buildFolderTree,
  getFolderAncestors,
  getFolderDescendants,
  getFolderPath,
  walkFoldersDepthFirst,
  wouldCreateFolderCycle
} from './folderTree';
import type { Folder } from './types';

/**
 * Builds a minimal folder fixture for tree tests.
 *
 * @param overrides - Fields to merge onto defaults.
 * @returns Folder row.
 */
function folder(
  overrides: Partial<Folder> & Pick<Folder, 'id' | 'name'> & { parent_folder_id?: number | null }
): Folder {
  return {
    collection_id: 1,
    uuid: `folder-${overrides.id}`,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...FOLDER_SETTINGS_DEFAULTS,
    parent_folder_id: overrides.parent_folder_id ?? null,
    ...overrides
  };
}

describe('buildFolderTree', () => {
  it('nests children under parents and sorts siblings', () => {
    const folders = [
      folder({ id: 1, name: 'B', sort_order: 1 }),
      folder({ id: 2, name: 'A', sort_order: 0 }),
      folder({ id: 3, name: 'Child', parent_folder_id: 2, sort_order: 0 }),
      folder({ id: 4, name: 'Z Child', parent_folder_id: 2, sort_order: 1 })
    ];

    const tree = buildFolderTree(folders);
    expect(tree.map((node) => node.folder.name)).toEqual(['A', 'B']);
    expect(tree[0]?.children.map((node) => node.folder.name)).toEqual(['Child', 'Z Child']);
  });

  it('treats folders with missing parents as roots', () => {
    const folders = [folder({ id: 5, name: 'Orphan', parent_folder_id: 999 })];
    expect(buildFolderTree(folders)).toHaveLength(1);
    expect(buildFolderTree(folders)[0]?.folder.name).toBe('Orphan');
  });
});

describe('getFolderAncestors and getFolderPath', () => {
  const folders = [
    folder({ id: 1, name: 'Auth' }),
    folder({ id: 2, name: 'Users', parent_folder_id: 1 }),
    folder({ id: 3, name: 'Admin', parent_folder_id: 2 })
  ];

  it('returns nearest parent first for ancestors', () => {
    expect(getFolderAncestors(3, folders).map((entry) => entry.name)).toEqual(['Users', 'Auth']);
  });

  it('builds a root-to-leaf path string', () => {
    expect(getFolderPath(3, folders)).toBe('Auth / Users / Admin');
    expect(getFolderPath(1, folders)).toBe('Auth');
    expect(getFolderPath(99, folders)).toBe('');
  });
});

describe('walkFoldersDepthFirst', () => {
  it('visits parents before descendants', () => {
    const folders = [
      folder({ id: 1, name: 'Root' }),
      folder({ id: 2, name: 'Child', parent_folder_id: 1 }),
      folder({ id: 3, name: 'Sibling' })
    ];
    const names: string[] = [];
    walkFoldersDepthFirst(buildFolderTree(folders), (entry) => {
      names.push(entry.name);
    });
    expect(names).toEqual(['Root', 'Child', 'Sibling']);
  });
});

describe('wouldCreateFolderCycle', () => {
  const folders = [
    folder({ id: 1, name: 'Root' }),
    folder({ id: 2, name: 'Child', parent_folder_id: 1 }),
    folder({ id: 3, name: 'Grand', parent_folder_id: 2 })
  ];

  it('detects self and descendant parents', () => {
    expect(wouldCreateFolderCycle(1, 1, folders)).toBe(true);
    expect(wouldCreateFolderCycle(1, 3, folders)).toBe(true);
    expect(wouldCreateFolderCycle(2, null, folders)).toBe(false);
    expect(wouldCreateFolderCycle(3, 1, folders)).toBe(false);
  });
});

describe('getFolderDescendants', () => {
  it('returns depth-first descendants excluding the root', () => {
    const folders = [
      folder({ id: 1, name: 'Root' }),
      folder({ id: 2, name: 'Child', parent_folder_id: 1 }),
      folder({ id: 3, name: 'Grand', parent_folder_id: 2 }),
      folder({ id: 4, name: 'Other' })
    ];
    expect(getFolderDescendants(1, folders).map((entry) => entry.id)).toEqual([2, 3]);
  });
});
