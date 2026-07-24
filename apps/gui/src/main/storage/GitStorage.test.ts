import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs';
import * as git from 'isomorphic-git';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitStorage } from './GitStorage';
import { buildGitDiff, makeCollectionScopedFilter } from '#/main/git/gitDiff';
import { collectionDirName } from '#/main/git/slug';
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

  it('writes collection folders and per-request files to the repository working tree', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('API');
    const harborRoot = join((db as GitStorage).syncManager.repoDir, '.harborclient');
    const collectionDirs = readdirSync(harborRoot).filter((entry) =>
      entry.startsWith('collection-')
    );
    expect(collectionDirs).toHaveLength(1);
    expect(existsSync(join(harborRoot, collectionDirs[0]!, 'collection.json'))).toBe(true);
    expect(existsSync(join(harborRoot, 'collections'))).toBe(false);

    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Get status', url: 'https://example.com/status' })
    );
    expect(existsSync(join(harborRoot, collectionDirs[0]!, `req-${saved.uuid}.json`))).toBe(true);

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
    const collectionDir = join(harborRoot, 'collection-api');
    const markdownFiles = readFileSync(join(harborRoot, 'README.md'), 'utf-8');
    expect(markdownFiles).toBe('# Harbor notes');
    expect(markdownFiles).not.toContain('collection_uuid:');
    expect(existsSync(join(collectionDir, 'README.md'))).toBe(false);

    const manifest = JSON.parse(readFileSync(join(collectionDir, 'collection.json'), 'utf-8')) as {
      documents?: Array<{ uuid: string; name: string; file: string }>;
    };
    expect(manifest.documents).toEqual([
      expect.objectContaining({
        name: 'README.md',
        file: 'README.md'
      })
    ]);

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

  it('disambiguates the same markdown display name across collections at the harbor root', async () => {
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

    await db.saveDocument(
      baseDocumentInput(collectionB.id, {
        name: 'readme.md',
        content: '# B'
      })
    );

    const documentsA = await db.listDocuments(collectionA.id);
    const documentsB = await db.listDocuments(collectionB.id);
    expect(documentsA).toHaveLength(1);
    expect(documentsB).toHaveLength(1);
    expect(documentsA[0]?.name).toBe('README.md');
    expect(documentsB[0]?.name).toBe('readme.md');
    expect(existsSync(join(repoPath, '.harborclient', 'README.md'))).toBe(true);
    expect(existsSync(join(repoPath, '.harborclient', 'readme-docs.md'))).toBe(true);
    expect(readFileSync(join(repoPath, '.harborclient', 'README.md'), 'utf-8')).toBe('# A');
    expect(readFileSync(join(repoPath, '.harborclient', 'readme-docs.md'), 'utf-8')).toBe('# B');

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('stages collection.json when a collection is created', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-create-manifest-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-create-manifest-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('create-manifest-connection', settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');

    const manifestPath = db.getCollectionManifestRepoPath(collection.id);
    const pathFlags = await db.syncManager.getPathFlagsUnderPrefix(manifestPath);
    expect(pathFlags[manifestPath]).toMatchObject({
      hasStagedChanges: true,
      isUntracked: false
    });
    expect(await db.getChangedItemCount(collection.id)).toBe(1);

    const diff = await buildGitDiff({
      repoPath: db.syncManager.repoDir,
      harborSubdir: '.harborclient',
      enrichDisplayNames: true,
      excludeUntracked: true,
      filepathFilter: makeCollectionScopedFilter(
        '.harborclient',
        collectionDirName(collection.name)
      )
    });
    expect(diff.files).toEqual([
      expect.objectContaining({
        path: manifestPath,
        status: 'added',
        displayName: 'API',
        resourceKind: 'collection'
      })
    ]);

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('reports per-item git status and stages or unstages request files', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-item-status-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-item-status-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('item-status-connection', settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Get status', url: 'https://example.com/status' })
    );

    const unstaged = await db.getItemGitStatuses(collection.id);
    expect(unstaged[saved.uuid]).toEqual({
      displayStatus: 'unstaged',
      canAdd: true,
      canRemove: false,
      isUntracked: true
    });

    await db.stageItem(collection.id, saved.uuid);
    const staged = await db.getItemGitStatuses(collection.id);
    expect(staged[saved.uuid]).toEqual({
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true,
      isUntracked: false
    });

    await db.unstageItem(collection.id, saved.uuid);
    const unstagedAgain = await db.getItemGitStatuses(collection.id);
    expect(unstagedAgain[saved.uuid]).toEqual({
      displayStatus: 'unstaged',
      canAdd: true,
      canRemove: false,
      isUntracked: true
    });

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('stages only untracked request files with stageAllUntrackedItems', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-stage-all-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-stage-all-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('stage-all-connection', settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    const tracked = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Tracked', url: 'https://example.com/tracked' })
    );
    await db.stageItem(collection.id, tracked.uuid);

    const untrackedA = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Untracked A', url: 'https://example.com/a' })
    );
    const untrackedB = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Untracked B', url: 'https://example.com/b' })
    );

    const stagedCount = await db.stageAllUntrackedItems(collection.id);
    expect(stagedCount).toBe(2);

    const statuses = await db.getItemGitStatuses(collection.id);
    expect(statuses[untrackedA.uuid]).toEqual({
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true,
      isUntracked: false
    });
    expect(statuses[untrackedB.uuid]).toEqual({
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true,
      isUntracked: false
    });
    // Tracked item remains staged (already was); no extra untracked work.
    expect(statuses[tracked.uuid]?.isUntracked).not.toBe(true);

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('auto-tracks newly created requests when Auto track is enabled', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-autotrack-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-autotrack-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('autotrack-connection', settings, userDataPath, () => true);
    await db.init();
    const collection = await db.createCollection('API');
    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Auto', url: 'https://example.com/auto' })
    );

    const statuses = await db.getItemGitStatuses(collection.id);
    expect(statuses[saved.uuid]).toEqual({
      displayStatus: 'staged',
      canAdd: false,
      canRemove: true,
      isUntracked: false
    });
    // Staged request plus staged collection.json (created with the collection).
    expect(await db.getChangedItemCount(collection.id)).toBe(2);

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('counts deleted request files in getChangedItemCount but not getItemGitStatuses', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-changed-count-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-changed-count-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('changed-count-connection', settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    const original = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Original', url: 'https://example.com/original' })
    );
    await db.stageItem(collection.id, original.uuid);
    await db.syncManager.commit('Initial commit', {
      collectionPrefix: db.getCollectionRepoRelativePath(collection.id)
    });

    await db.deleteRequest(original.id);
    const added = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Added', url: 'https://example.com/added' })
    );

    const itemStatuses = await db.getItemGitStatuses(collection.id);
    expect(Object.keys(itemStatuses)).toEqual([added.uuid]);
    // Counts the deleted tracked request. The untracked addition is excluded.
    // (collection.json may also change; isomorphic-git can miss same-size
    // rewrites here, so do not assert a precise combined total.)
    expect(await db.getChangedItemCount(collection.id)).toBeGreaterThanOrEqual(1);

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('matches getChangedItemCount with buildGitDiff file count for the same collection', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-count-align-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-count-align-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('count-align-connection', settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    const tracked = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Tracked', url: 'https://example.com/tracked' })
    );
    await db.stageItem(collection.id, tracked.uuid);
    await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Untracked', url: 'https://example.com/untracked' })
    );

    const changedCount = await db.getChangedItemCount(collection.id);
    const diff = await buildGitDiff({
      repoPath: db.syncManager.repoDir,
      harborSubdir: '.harborclient',
      excludeUntracked: true,
      filepathFilter: makeCollectionScopedFilter(
        '.harborclient',
        collectionDirName(collection.name)
      )
    });

    expect(changedCount).toBe(2);
    expect(diff.files).toHaveLength(changedCount);

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('reports one modified change when a tracked request is renamed', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-rename-diff-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-rename-diff-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('rename-diff-connection', settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Echo POST', url: 'https://example.com/posts' })
    );
    await db.stageItem(collection.id, saved.uuid);
    await git.add({ fs, dir: repoPath, filepath: '.harborclient' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add request',
      author: { name: 'Test', email: 'test@example.com' }
    });

    await db.saveRequest(
      baseRequestInput(collection.id, {
        id: saved.id,
        name: 'Echo POST 2',
        url: 'https://example.com/posts'
      })
    );

    const diff = await buildGitDiff({
      repoPath: db.syncManager.repoDir,
      harborSubdir: '.harborclient',
      enrichDisplayNames: true,
      excludeUntracked: true,
      filepathFilter: makeCollectionScopedFilter(
        '.harborclient',
        collectionDirName(collection.name)
      )
    });

    const requestPath = `.harborclient/${collectionDirName(collection.name)}/req-${saved.uuid}.json`;

    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]).toMatchObject({
      path: requestPath,
      status: 'modified',
      displayName: 'Echo POST 2',
      resourceKind: 'request',
      method: 'GET'
    });
    expect(diff.files[0]?.renamedFrom).toBeUndefined();
    expect(diff.files[0]?.previousPaths).toBeUndefined();

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('recovers buried orphan request files with a new uuid on reload', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-orphan-recover-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-orphan-recover-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const connectionId = 'orphan-recover-connection';
    const db = new GitStorage(connectionId, settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Visible', url: 'https://example.com/visible' })
    );

    const collectionDir = join(repoPath, '.harborclient', collectionDirName(collection.name));
    writeFileSync(
      join(collectionDir, 'req-buried.json'),
      JSON.stringify({
        harborclientVersion: 1,
        harborclientExport: 'request',
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Buried request',
        method: 'GET',
        url: 'https://example.com/buried',
        headers: [],
        params: [],
        body: '',
        body_type: 'none'
      })
    );

    await db.reloadFromDisk();
    const requests = await db.listRequests(collection.id);
    expect(requests.map((request) => request.name).sort()).toEqual(
      ['Buried request', 'Visible'].sort()
    );
    expect(requests.some((request) => request.uuid === saved.uuid)).toBe(true);

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });

  it('reverts a renamed request by restoring the in-place file contents', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-git-rename-revert-'));
    const userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-git-rename-revert-userdata-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.name', value: 'Test' });
    await git.setConfig({ fs, dir: repoPath, path: 'user.email', value: 'test@example.com' });

    const settings: GitSettings = {
      repoPath,
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      auth: { kind: 'pat', username: 'token' }
    };

    const db = new GitStorage('rename-revert-connection', settings, userDataPath);
    await db.init();
    const collection = await db.createCollection('API');
    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Echo POST', url: 'https://example.com/posts' })
    );
    await db.stageItem(collection.id, saved.uuid);
    await git.add({ fs, dir: repoPath, filepath: '.harborclient' });
    await git.commit({
      fs,
      dir: repoPath,
      message: 'Add request',
      author: { name: 'Test', email: 'test@example.com' }
    });

    await db.saveRequest(
      baseRequestInput(collection.id, {
        id: saved.id,
        name: 'Echo POST 2',
        url: 'https://example.com/posts'
      })
    );

    const collectionDir = join(repoPath, '.harborclient', collectionDirName(collection.name));
    const requestFileName = `req-${saved.uuid}.json`;
    const requestPath = `.harborclient/${collectionDirName(collection.name)}/${requestFileName}`;
    expect(existsSync(join(collectionDir, requestFileName))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(collectionDir, requestFileName), 'utf-8')) as { name?: string }
    ).toMatchObject({ name: 'Echo POST 2' });

    await db.syncManager.revertFile(requestPath);
    await db.reloadFromDisk();

    expect(existsSync(join(collectionDir, requestFileName))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(collectionDir, requestFileName), 'utf-8')) as { name?: string }
    ).toMatchObject({ name: 'Echo POST' });

    const requests = await db.listRequests(collection.id);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.name).toBe('Echo POST');

    await db.close();
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(userDataPath, { recursive: true, force: true });
  });
});
