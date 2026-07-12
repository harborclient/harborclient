import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCollectionExport } from '#/main/storage/collectionData';
import { LocalDatabase } from '#/main/storage/LocalDatabase';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { SqliteStorage } from '#/main/storage/SqliteStorage';
import {
  BUILTIN_COLLECTIONS_OPEN_REQUEST_KEY,
  BUILTIN_COLLECTIONS_SEEDED_KEY,
  GETTING_STARTED_SEEN_KEY,
  importBuiltinCollectionExports,
  isSeedFlagEnabled,
  loadBuiltinCollectionExportsFromDirectory,
  parseBuiltinCollectionOpenRequestTarget,
  resolveFirstBuiltinOpenRequestTarget,
  seedBuiltinCollectionsIfMissing,
  seedDefaultContentIfNeeded
} from '#/main/storage/seedDefaultContent';
import type { SqliteSettings, StorageConnection } from '#/shared/types';
import { describeSqlite } from '#/test/nativeModules';

const { getAppPath } = vi.hoisted(() => ({
  getAppPath: vi.fn(() => join(process.cwd()))
}));

const TEST_APP_DATA = join(tmpdir(), 'harborclient-seed-appdata');

vi.mock('electron', () => ({
  app: {
    getAppPath,
    isPackaged: false,
    getPath: vi.fn((name: string) => {
      if (name === 'appData') {
        return TEST_APP_DATA;
      }
      return tmpdir();
    })
  }
}));

const BASE_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

const SQLITE_CONNECTION: StorageConnection = {
  id: 'conn-sqlite',
  name: 'SQLite',
  type: 'sqlite',
  settings: { ...BASE_SQLITE_SETTINGS, dbFilename: 'seed.db' }
};

const BUILTIN_COLLECTIONS_DIR = join(process.cwd(), 'resources/builtin_collections');

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

/**
 * Builds a routing storage fixture with a single mounted SQLite backend for seed tests.
 *
 * @returns Router, local registry, sqlite backend, and temp root directory.
 */
async function createSeedFixture(): Promise<{
  router: RoutingStorage;
  database: LocalDatabase;
  backend: SqliteStorage;
  rootDir: string;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-seed-'));
  const database = new LocalDatabase(rootDir);
  await database.init();

  const backendDir = join(rootDir, 'backend');
  mkdirSync(backendDir, { recursive: true });

  const backend = new SqliteStorage(backendDir, SQLITE_CONNECTION.settings as SqliteSettings);
  await backend.init();

  const router = new RoutingStorage(database, SQLITE_CONNECTION.id, rootDir);
  router.mount(0, SQLITE_CONNECTION, backend);

  cleanups.push(async () => {
    await router.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  return { router, database, backend, rootDir };
}

describe('loadBuiltinCollectionExportsFromDirectory', () => {
  it('loads the shipped HarborClient Echo export', () => {
    const exports = loadBuiltinCollectionExportsFromDirectory(BUILTIN_COLLECTIONS_DIR);

    expect(exports.length).toBeGreaterThanOrEqual(1);
    const echo = exports.find((entry) => entry.name === 'HarborClient Echo');
    expect(echo).toBeDefined();
    expect(validateCollectionExport(echo!).name).toBe('HarborClient Echo');
    expect(echo!.requests).toHaveLength(4);
    expect(echo!.requests.some((request) => (request.post_request_scripts?.length ?? 0) > 0)).toBe(
      true
    );
  });

  it('skips invalid JSON files and keeps valid exports', () => {
    const directory = mkdtempSync(join(tmpdir(), 'harborclient-builtin-collections-'));
    cleanups.push(() => {
      rmSync(directory, { recursive: true, force: true });
    });

    writeFileSync(
      join(directory, 'valid.json'),
      JSON.stringify({
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Valid',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        requests: [
          {
            name: 'Health',
            method: 'GET',
            url: 'https://example.com/health',
            headers: [],
            params: [],
            body: '',
            body_type: 'none',
            pre_request_script: '',
            post_request_script: '',
            comment: '',
            tags: '',
            sort_order: 0
          }
        ]
      })
    );
    writeFileSync(join(directory, 'invalid.json'), '{ not json');

    const exports = loadBuiltinCollectionExportsFromDirectory(directory);

    expect(exports).toHaveLength(1);
    expect(exports[0]?.name).toBe('Valid');
  });
});

describe('resolveFirstBuiltinOpenRequestTarget', () => {
  it('returns the lowest sort_order request from the first export', () => {
    const target = resolveFirstBuiltinOpenRequestTarget([
      {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        uuid: '11111111-1111-4111-8111-111111111111',
        name: 'First',
        variables: [],
        headers: [],
        pre_request_script: '',
        post_request_script: '',
        requests: [
          {
            uuid: '22222222-2222-4222-8222-222222222222',
            name: 'Later',
            method: 'GET',
            url: 'https://example.com/later',
            headers: [],
            params: [],
            body: '',
            body_type: 'none',
            pre_request_script: '',
            post_request_script: '',
            comment: '',
            tags: '',
            sort_order: 2
          },
          {
            uuid: '33333333-3333-4333-8333-333333333333',
            name: 'First',
            method: 'GET',
            url: 'https://example.com/first',
            headers: [],
            params: [],
            body: '',
            body_type: 'none',
            pre_request_script: '',
            post_request_script: '',
            comment: '',
            tags: '',
            sort_order: 0
          }
        ]
      }
    ]);

    expect(target).toEqual({
      collectionUuid: '11111111-1111-4111-8111-111111111111',
      requestUuid: '33333333-3333-4333-8333-333333333333'
    });
  });

  it('returns null when the first collection has no requests with uuids', () => {
    expect(
      resolveFirstBuiltinOpenRequestTarget([
        {
          harborclientVersion: 1,
          harborclientExport: 'collection',
          uuid: '11111111-1111-4111-8111-111111111111',
          name: 'Empty',
          variables: [],
          headers: [],
          pre_request_script: '',
          post_request_script: '',
          requests: [
            {
              name: 'No uuid',
              method: 'GET',
              url: 'https://example.com',
              headers: [],
              params: [],
              body: '',
              body_type: 'none',
              pre_request_script: '',
              post_request_script: '',
              comment: '',
              tags: '',
              sort_order: 0
            }
          ]
        }
      ])
    ).toBeNull();
  });
});

describe('parseBuiltinCollectionOpenRequestTarget', () => {
  it('parses a valid serialized target', () => {
    expect(
      parseBuiltinCollectionOpenRequestTarget(
        JSON.stringify({
          collectionUuid: '11111111-1111-4111-8111-111111111111',
          requestUuid: '22222222-2222-4222-8222-222222222222'
        })
      )
    ).toEqual({
      collectionUuid: '11111111-1111-4111-8111-111111111111',
      requestUuid: '22222222-2222-4222-8222-222222222222'
    });
  });

  it('returns null for invalid payloads', () => {
    expect(parseBuiltinCollectionOpenRequestTarget(undefined)).toBeNull();
    expect(parseBuiltinCollectionOpenRequestTarget('{bad json')).toBeNull();
    expect(
      parseBuiltinCollectionOpenRequestTarget(JSON.stringify({ collectionUuid: '' }))
    ).toBeNull();
  });
});

describeSqlite('seedDefaultContentIfNeeded', () => {
  beforeEach(() => {
    getAppPath.mockReturnValue(process.cwd());
  });

  it('imports built-in collections on a fresh install', async () => {
    const { router, database, backend } = await createSeedFixture();

    await seedDefaultContentIfNeeded(router, database);

    expect(database.getSetting(BUILTIN_COLLECTIONS_SEEDED_KEY)).toBe('1');

    const collections = await router.listCollections();
    expect(collections.length).toBeGreaterThanOrEqual(1);

    const echo = collections.find((collection) => collection.name === 'HarborClient Echo');
    expect(echo?.name).toBe('HarborClient Echo');

    const exports = loadBuiltinCollectionExportsFromDirectory(BUILTIN_COLLECTIONS_DIR);
    const openTarget = resolveFirstBuiltinOpenRequestTarget(exports);
    expect(
      parseBuiltinCollectionOpenRequestTarget(
        database.getSetting(BUILTIN_COLLECTIONS_OPEN_REQUEST_KEY)
      )
    ).toEqual(openTarget);

    const requests = await backend.listRequests(echo!.id);
    expect(requests).toHaveLength(4);

    const openRequest = requests.find((request) => request.uuid === openTarget?.requestUuid);
    expect(openRequest).toBeDefined();
    expect(database.getSetting(GETTING_STARTED_SEEN_KEY)).toBe('1');
  });

  it('skips seeding when the flag is already set', async () => {
    const { router, database } = await createSeedFixture();
    database.setSetting(BUILTIN_COLLECTIONS_SEEDED_KEY, '1');

    await seedDefaultContentIfNeeded(router, database);

    expect(await router.listCollections()).toEqual([]);
    expect(database.getSetting(BUILTIN_COLLECTIONS_OPEN_REQUEST_KEY)).toBeUndefined();
  });

  it('imports built-in collections when the registry already has other entries', async () => {
    const { router, database } = await createSeedFixture();

    await router.createCollection('Existing');

    await seedDefaultContentIfNeeded(router, database);

    expect(database.getSetting(BUILTIN_COLLECTIONS_SEEDED_KEY)).toBe('1');
    const collections = await router.listCollections();
    expect(collections.some((collection) => collection.name === 'Existing')).toBe(true);
    expect(collections.some((collection) => collection.name === 'HarborClient Echo')).toBe(true);

    const exports = loadBuiltinCollectionExportsFromDirectory(BUILTIN_COLLECTIONS_DIR);
    const openTarget = resolveFirstBuiltinOpenRequestTarget(exports);
    expect(
      parseBuiltinCollectionOpenRequestTarget(
        database.getSetting(BUILTIN_COLLECTIONS_OPEN_REQUEST_KEY)
      )
    ).toEqual(openTarget);
    expect(database.getSetting(GETTING_STARTED_SEEN_KEY)).toBe('1');
  });
});

describe('isSeedFlagEnabled', () => {
  it('returns true when --seed is present', () => {
    expect(isSeedFlagEnabled(['electron', '--seed'])).toBe(true);
  });

  it('returns false when --seed is absent', () => {
    expect(isSeedFlagEnabled(['electron', '--verbose'])).toBe(false);
  });
});

describeSqlite('seedBuiltinCollectionsIfMissing', () => {
  beforeEach(() => {
    getAppPath.mockReturnValue(process.cwd());
  });

  it('imports built-in collections on an empty database', async () => {
    const { router } = await createSeedFixture();

    const importedCount = await seedBuiltinCollectionsIfMissing(router);

    expect(importedCount).toBeGreaterThanOrEqual(1);
    const collections = await router.listCollections();
    expect(collections.some((collection) => collection.name === 'HarborClient Echo')).toBe(true);
  });

  it('skips import when built-in collections already exist', async () => {
    const { router } = await createSeedFixture();
    const exports = loadBuiltinCollectionExportsFromDirectory(BUILTIN_COLLECTIONS_DIR);

    expect(await importBuiltinCollectionExports(router, exports)).toBeGreaterThanOrEqual(1);
    expect(await seedBuiltinCollectionsIfMissing(router)).toBe(0);

    const collections = await router.listCollections();
    expect(
      collections.filter((collection) => collection.name === 'HarborClient Echo')
    ).toHaveLength(1);
  });

  it('imports missing built-in collections alongside existing collections', async () => {
    const { router } = await createSeedFixture();

    await router.createCollection('Existing');

    const importedCount = await seedBuiltinCollectionsIfMissing(router);

    expect(importedCount).toBeGreaterThanOrEqual(1);
    const collections = await router.listCollections();
    expect(collections.some((collection) => collection.name === 'Existing')).toBe(true);
    expect(collections.some((collection) => collection.name === 'HarborClient Echo')).toBe(true);
  });
});
