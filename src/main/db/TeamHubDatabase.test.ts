import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it, vi } from 'vitest';
import { TeamHubDatabase } from '#/main/db/TeamHubDatabase';
import { TeamHubIdMap } from '#/main/db/TeamHubIdMap';
import type { HarborServerClient } from '#/main/server/HarborServerClient';
import { describeSqlite } from '#/test/nativeModules';

describeSqlite('TeamHubDatabase', () => {
  const cleanups: Array<() => void> = [];

  /**
   * Builds a TeamHubDatabase backed by a mock HarborServerClient and temp id map.
   */
  function createDatabase(client: Partial<HarborServerClient>): TeamHubDatabase {
    const dir = mkdtempSync(join(tmpdir(), 'harborclient-shub-'));
    const idMap = new TeamHubIdMap(join(dir, 'team-hub-test.db'));
    idMap.init();
    cleanups.push(() => {
      idMap.close();
      rmSync(dir, { recursive: true, force: true });
    });
    return new TeamHubDatabase(client as HarborServerClient, idMap);
  }

  afterEach(() => {
    vi.restoreAllMocks();
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it('maps server collection fields and ids when listing collections', async () => {
    const serverId = '550e8400-e29b-41d4-a716-446655440000';
    const db = createDatabase({
      listCollections: vi.fn().mockResolvedValue([
        {
          id: serverId,
          name: 'Team API',
          variables: [{ key: 'base', value: 'https://example.com', defaultValue: '', share: true }],
          headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
          auth: {
            type: 'none',
            basic: { username: '', password: '' },
            bearer: { token: '' }
          },
          preRequestScript: 'console.log("pre")',
          postRequestScript: 'console.log("post")',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    });

    const [collection] = await db.listCollections();
    expect(collection.id).toBe(1);
    expect(collection.name).toBe('Team API');
    expect(collection.pre_request_script).toBe('console.log("pre")');
    expect(collection.post_request_script).toBe('console.log("post")');
    expect(db.getServerCollectionId(collection.id)).toBe(serverId);
  });

  it('translates create and update collection calls to server UUIDs', async () => {
    const serverId = '660e8400-e29b-41d4-a716-446655440001';
    const createCollection = vi.fn().mockResolvedValue({
      id: serverId,
      name: 'New',
      variables: [],
      headers: [],
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      },
      preRequestScript: '',
      postRequestScript: '',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const updateCollection = vi.fn().mockResolvedValue({
      id: serverId,
      name: 'Renamed',
      variables: [],
      headers: [],
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      },
      preRequestScript: 'pre',
      postRequestScript: 'post',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const db = createDatabase({ createCollection, updateCollection });

    const created = await db.createCollection('New');
    const updated = await db.updateCollection(created.id, 'Renamed', [], [], 'pre', 'post', {
      type: 'none',
      basic: { username: '', password: '' },
      bearer: { token: '' }
    });

    expect(createCollection).toHaveBeenCalledWith({ name: 'New' });
    expect(updateCollection).toHaveBeenCalledWith(serverId, {
      name: 'Renamed',
      variables: [],
      headers: [],
      preRequestScript: 'pre',
      postRequestScript: 'post',
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      }
    });
    expect(updated.name).toBe('Renamed');
  });

  it('maps request folder ids and bodyType when saving a request', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440002';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440003';
    const requestServerId = '990e8400-e29b-41d4-a716-446655440004';

    const db = createDatabase({
      createRequest: vi.fn().mockResolvedValue({
        id: requestServerId,
        collectionId: collectionServerId,
        name: 'Get health',
        method: 'GET',
        url: '{{base}}/health',
        headers: [],
        params: [],
        auth: {
          type: 'none',
          basic: { username: '', password: '' },
          bearer: { token: '' }
        },
        body: '',
        bodyType: 'none',
        preRequestScript: '',
        postRequestScript: '',
        comment: '',
        folderId: folderServerId,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    });

    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);
    const folderId = idMap.toLocalId('folder', folderServerId);

    const saved = await db.saveRequest({
      collection_id: collectionId,
      folder_id: folderId,
      name: 'Get health',
      method: 'GET',
      url: '{{base}}/health',
      headers: [],
      params: [],
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      },
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      comment: ''
    });

    expect(saved.id).toBeGreaterThan(0);
    expect(saved.folder_id).toBe(folderId);
    expect(saved.body_type).toBe('none');
  });
});
