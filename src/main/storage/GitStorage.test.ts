import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitStorage } from '#/main/storage/GitStorage';
import {
  baseRequestInput,
  runIstorageContractSuite,
  type TestDbHandle
} from '#/test/istorageContract';
import type { GitSettings } from '#/shared/types';

const cleanups: Array<() => void> = [];

/**
 * Creates an isolated git-backed database in a temporary repository directory.
 */
async function createTestDb(): Promise<TestDbHandle> {
  const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-repo-'));
  const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-userdata-'));
  mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

  const settings: GitSettings = {
    repoPath,
    url: 'https://github.com/example/repo.git',
    branch: 'main',
    subdir: '.harborclient',
    auth: { kind: 'pat', username: 'token' }
  };

  const db = new GitStorage('test-git-connection', settings, userDataPath);
  await db.init();

  cleanups.push(() => {
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  return {
    db,
    cleanup: async () => {
      await db.close();
    }
  };
}

describe('GitStorage', () => {
  afterEach(() => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  });

  runIstorageContractSuite('GitStorage', createTestDb);

  it('writes collection files to the repository working tree', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('API');
    const collectionPath = join(
      (db as GitStorage).syncManager.repoDir,
      '.harborclient',
      'collections'
    );
    expect(existsSync(collectionPath)).toBe(true);

    await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Get status', url: 'https://example.com/status' })
    );

    const exported = await db.exportCollectionData(collection.id);
    expect(exported.requests.length).toBe(1);
    expect(exported.requests[0]?.name).toBe('Get status');
  });

  it('reloads collections after saveRequest writes string-encoded script columns', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-reload-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-reload-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const connectionId = 'reload-test-connection';
    const first = new GitStorage(connectionId, settings, userDataPath);
    await first.init();
    const collection = await first.createCollection('API');
    await first.saveRequest(
      baseRequestInput(collection.id, { name: 'Get status', url: 'https://example.com/status' })
    );
    await first.close();

    const second = new GitStorage(connectionId, settings, userDataPath);
    await second.init();
    const collections = await second.listCollections();
    const reloaded = collections.find((item) => item.name === 'API');
    expect(reloaded).toBeDefined();
    const requests = await second.listRequests(reloaded!.id);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.name).toBe('Get status');
    await second.close();

    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });
});
