import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  assignGitId,
  createEmptyGitIdIndex,
  loadGitIdIndex,
  pruneGitIdMap,
  saveGitIdIndex
} from './idIndex';

describe('git id index', () => {
  it('assigns stable numeric ids and reuses mappings', () => {
    const index = createEmptyGitIdIndex();
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const first = assignGitId(index, 'collectionIds', 'nextCollectionId', uuid);
    const second = assignGitId(index, 'collectionIds', 'nextCollectionId', uuid);

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(index.nextCollectionId).toBe(2);
  });

  it('persists and reloads index data from userData', () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'hc-git-index-'));
    const connectionId = 'conn-1';
    const index = createEmptyGitIdIndex();
    assignGitId(index, 'requestIds', 'nextRequestId', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    saveGitIdIndex(userDataPath, connectionId, index);

    const loaded = loadGitIdIndex(userDataPath, connectionId);
    expect(loaded.requestIds['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']).toBe(1);
    expect(existsSync(join(userDataPath, 'git-index', `${connectionId}.json`))).toBe(true);

    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('prunes uuid mappings that are no longer on disk', () => {
    const index = createEmptyGitIdIndex();
    assignGitId(index, 'folderIds', 'nextFolderId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    assignGitId(index, 'folderIds', 'nextFolderId', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');

    pruneGitIdMap(index, 'folderIds', new Set(['cccccccc-cccc-4ccc-8ccc-cccccccccccc']));

    expect(index.folderIds['cccccccc-cccc-4ccc-8ccc-cccccccccccc']).toBe(1);
    expect(index.folderIds['dddddddd-dddd-4ddd-8ddd-dddddddddddd']).toBeUndefined();
  });
});
