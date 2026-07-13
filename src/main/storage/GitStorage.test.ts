import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitStorage } from '#/main/storage/GitStorage';
import {
  baseDocumentInput,
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

  it('reloads a renamed request without duplicate stale rows', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-rename-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-rename-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const connectionId = 'rename-test-connection';
    const db = new GitStorage(connectionId, settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('Git test');
    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Untitled Request', url: '' })
    );

    await db.saveRequest(
      baseRequestInput(collection.id, {
        id: saved.id,
        name: 'Echo Get',
        url: 'https://echo.harborclient.com/get'
      })
    );
    await db.reloadFromDisk();

    const requests = await db.listRequests(collection.id);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.name).toBe('Echo Get');
    expect(requests[0]?.url).toBe('https://echo.harborclient.com/get');
    await db.close();

    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('writes markdown documents at the harbor root without YAML frontmatter', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-doc-repo-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-doc-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const connectionId = 'document-test-connection';
    const db = new GitStorage(connectionId, settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    await db.saveDocument(
      baseDocumentInput(collection.id, {
        name: 'README.md',
        content: '# Harbor notes'
      })
    );

    const harborRoot = join(repoPath, '.harborclient');
    const markdownFiles = readFileSync(join(harborRoot, 'README.md'), 'utf-8');
    expect(markdownFiles).toBe('# Harbor notes');
    expect(markdownFiles).not.toContain('collection_uuid:');

    const collectionDirPath = readdirSync(join(harborRoot, 'collections')).find((entry) =>
      entry.includes(collection.uuid)
    );
    expect(collectionDirPath).toBeTruthy();
    const manifest = JSON.parse(
      readFileSync(join(harborRoot, 'collections', collectionDirPath!, 'collection.json'), 'utf-8')
    ) as { documents?: Array<{ uuid: string; name: string }> };
    expect(manifest.documents).toEqual([
      expect.objectContaining({
        name: 'README.md'
      })
    ]);
    expect(existsSync(join(harborRoot, 'collections'))).toBe(true);

    await db.close();

    const reloaded = new GitStorage(connectionId, settings, userDataPath);
    await reloaded.init();
    const documents = await reloaded.listDocuments(collection.id);
    expect(documents).toHaveLength(1);
    expect(documents[0]?.name).toBe('README.md');
    expect(documents[0]?.content).toBe('# Harbor notes');
    await reloaded.close();

    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('rejects case-insensitive duplicate markdown document names across collections', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-doc-collision-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-doc-collision-user-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const connectionId = 'document-collision-connection';
    const db = new GitStorage(connectionId, settings, userDataPath);
    await db.init();
    const collectionA = await db.createCollection('API');
    const collectionB = await db.createCollection('Docs');

    await db.saveDocument(
      baseDocumentInput(collectionA.id, {
        name: 'README.md',
        content: '# A'
      })
    );

    await expect(
      db.saveDocument(
        baseDocumentInput(collectionB.id, {
          name: 'readme.md',
          content: '# B'
        })
      )
    ).rejects.toThrow(/already exists/i);

    const documents = await db.listDocuments(collectionB.id);
    expect(documents).toHaveLength(0);

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });
});
