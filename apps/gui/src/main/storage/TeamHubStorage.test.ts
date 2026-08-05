import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it, vi } from 'vitest';
import { TeamHubStorage } from './TeamHubStorage';
import { defaultAuth } from '@harborclient/core/auth';
import { createInlineScriptRef } from '@harborclient/core/scriptRefs';
import { TeamHubIdMap } from './TeamHubIdMap';
import { TeamHubFolderSettings } from './TeamHubFolderSettings';
import type { TeamHubClient } from '@harborclient/team-hub-api';
import { describeSqlite } from '#/test/nativeModules';

describeSqlite('TeamHubStorage', () => {
  const cleanups: Array<() => void> = [];

  /**
   * Builds a TeamHubStorage backed by a mock TeamHubClient and temp id map.
   */
  function createStorage(client: Partial<TeamHubClient>): TeamHubStorage {
    const dir = mkdtempSync(join(tmpdir(), 'harborclient-shub-'));
    const dbPath = join(dir, 'team-hub-test.db');
    const idMap = new TeamHubIdMap(dbPath);
    idMap.init();
    const folderSettings = new TeamHubFolderSettings(dbPath);
    folderSettings.init();
    cleanups.push(() => {
      idMap.close();
      folderSettings.close();
      rmSync(dir, { recursive: true, force: true });
    });
    const documentDefaults: Partial<TeamHubClient> = {
      listRequests: vi.fn().mockResolvedValue([]),
      listDocuments: vi.fn().mockResolvedValue([]),
      createDocument: vi.fn(),
      updateDocument: vi.fn(),
      deleteDocument: vi.fn(),
      reorderDocuments: vi.fn(),
      moveDocument: vi.fn(),
      moveFolder: vi.fn()
    };
    return new TeamHubStorage(
      { ...documentDefaults, ...client } as TeamHubClient,
      idMap,
      folderSettings
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it('maps server collection fields and ids when listing collections', async () => {
    const serverId = '550e8400-e29b-41d4-a716-446655440000';
    const db = createStorage({
      listCollections: vi.fn().mockResolvedValue([
        {
          id: serverId,
          name: 'Team API',
          variables: [
            {
              key: 'base',
              value: 'https://example.com',
              defaultValue: '',
              enabled: true,
              share: true
            }
          ],
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

  it('maps server environment fields and ids when listing environments', async () => {
    const serverId = '770e8400-e29b-41d4-a716-446655440010';
    const db = createStorage({
      listEnvironments: vi.fn().mockResolvedValue([
        {
          id: serverId,
          name: 'Production',
          variables: [
            {
              key: 'host',
              value: 'https://api.example.com',
              defaultValue: '',
              enabled: true,
              share: true
            }
          ],
          createdAt: '2026-01-02T00:00:00.000Z'
        }
      ])
    });

    const [environment] = await db.listEnvironments();
    expect(environment.id).toBe(1);
    expect(environment.name).toBe('Production');
    expect(environment.variables).toEqual([
      {
        key: 'host',
        value: 'https://api.example.com',
        defaultValue: '',
        enabled: true,
        share: true
      }
    ]);
    expect(environment.uuid).toBe(serverId);
  });

  it('translates create and update collection calls to server UUIDs', async () => {
    const serverId = '660e8400-e29b-41d4-a716-446655440001';
    const createCollection = vi.fn().mockResolvedValue({
      id: serverId,
      name: 'New',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      preRequestScript: '',
      postRequestScript: '',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const updateCollection = vi.fn().mockResolvedValue({
      id: serverId,
      name: 'Renamed',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      preRequestScript: 'pre',
      postRequestScript: 'post',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    const db = createStorage({ createCollection, updateCollection });

    const created = await db.createCollection('New');
    const updated = await db.updateCollection(
      created.id,
      'Renamed',
      [],
      [],
      'pre',
      'post',
      defaultAuth(),
      ''
    );

    expect(createCollection).toHaveBeenCalledWith({ name: 'New' });
    expect(updateCollection).toHaveBeenCalledWith(
      serverId,
      expect.objectContaining({
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
      })
    );
    const updatePayload = updateCollection.mock.calls[0]?.[1] as {
      pre_request_scripts: string;
      post_request_scripts: string;
    };
    expect(JSON.parse(updatePayload.pre_request_scripts)).toEqual([
      expect.objectContaining({ enabled: true, kind: 'inline', code: 'pre' })
    ]);
    expect(JSON.parse(updatePayload.post_request_scripts)).toEqual([
      expect.objectContaining({ enabled: true, kind: 'inline', code: 'post' })
    ]);
    expect(updated.name).toBe('Renamed');
  });

  it('maps request folder ids and bodyType when saving a request', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440002';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440003';
    const requestServerId = '990e8400-e29b-41d4-a716-446655440004';

    const db = createStorage({
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
        tags: '',
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
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
    });

    expect(saved.id).toBeGreaterThan(0);
    expect(saved.folder_id).toBe(folderId);
    expect(saved.body_type).toBe('none');
  });

  it('encodes multiple pre-request scripts in the legacy Team Hub column', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440002';
    const requestServerId = '990e8400-e29b-41d4-a716-446655440004';
    const preScripts = [
      {
        id: 'script-a',
        enabled: true,
        kind: 'inline' as const,
        name: 'First',
        code: 'console.log("one")'
      },
      {
        id: 'script-b',
        enabled: true,
        kind: 'inline' as const,
        name: 'Second',
        code: 'console.log("two")'
      }
    ];

    const createRequest = vi.fn().mockImplementation((_collectionId, body) =>
      Promise.resolve({
        id: requestServerId,
        collectionId: collectionServerId,
        name: body.name,
        method: body.method,
        url: body.url,
        headers: body.headers,
        params: body.params,
        auth: body.auth,
        body: body.body,
        bodyType: body.bodyType,
        preRequestScript: body.preRequestScript,
        postRequestScript: body.postRequestScript,
        comment: body.comment,
        folderId: body.folderId,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    );
    const db = createStorage({ createRequest });
    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);

    const saved = await db.saveRequest({
      collection_id: collectionId,
      folder_id: null,
      name: 'Multi script',
      method: 'GET',
      url: 'https://example.com',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: preScripts,
      post_request_scripts: [],
      comment: '',
      tags: ''
    });

    const createPayload = createRequest.mock.calls[0]?.[1] as { preRequestScript: string };
    expect(createPayload.preRequestScript.trim().startsWith('[')).toBe(true);
    expect(JSON.parse(createPayload.preRequestScript)).toHaveLength(2);
    expect(saved.pre_request_scripts).toHaveLength(2);
    expect(saved.pre_request_scripts[0]?.name).toBe('First');
    expect(saved.pre_request_scripts[1]?.name).toBe('Second');
  });

  it('round-trips a single anonymous empty pre-request script through Team Hub', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440002';
    const requestServerId = '990e8400-e29b-41d4-a716-446655440005';
    const defaultScript = createInlineScriptRef('');

    const createRequest = vi.fn().mockImplementation((_collectionId, body) =>
      Promise.resolve({
        id: requestServerId,
        collectionId: collectionServerId,
        name: body.name,
        method: body.method,
        url: body.url,
        headers: body.headers,
        params: body.params,
        auth: body.auth,
        body: body.body,
        bodyType: body.bodyType,
        preRequestScript: body.preRequestScript,
        postRequestScript: body.postRequestScript,
        comment: body.comment,
        folderId: body.folderId,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    );
    const db = createStorage({ createRequest });
    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);

    const saved = await db.saveRequest({
      collection_id: collectionId,
      folder_id: null,
      name: 'Default script',
      method: 'GET',
      url: 'https://example.com',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [defaultScript],
      post_request_scripts: [],
      comment: '',
      tags: ''
    });

    const createPayload = createRequest.mock.calls[0]?.[1] as { preRequestScript: string };
    expect(createPayload.preRequestScript.trim().startsWith('[')).toBe(true);
    expect(saved.pre_request_scripts).toHaveLength(1);
    expect(saved.pre_request_scripts[0]).toMatchObject({
      enabled: true,
      kind: 'inline',
      code: ''
    });
  });

  it('stores a single anonymous inline script with code as plain Team Hub text', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440002';
    const requestServerId = '990e8400-e29b-41d4-a716-446655440006';

    const createRequest = vi.fn().mockImplementation((_collectionId, body) =>
      Promise.resolve({
        id: requestServerId,
        collectionId: collectionServerId,
        name: body.name,
        method: body.method,
        url: body.url,
        headers: body.headers,
        params: body.params,
        auth: body.auth,
        body: body.body,
        bodyType: body.bodyType,
        preRequestScript: body.preRequestScript,
        postRequestScript: body.postRequestScript,
        comment: body.comment,
        folderId: body.folderId,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    );
    const db = createStorage({ createRequest });
    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);

    const saved = await db.saveRequest({
      collection_id: collectionId,
      folder_id: null,
      name: 'Plain script',
      method: 'GET',
      url: 'https://example.com',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none',
      body_raw: null,
      body_raw_open: false,
      pre_request_script: 'console.log(1);',
      post_request_script: '',
      pre_request_scripts: [createInlineScriptRef('console.log(1);')],
      post_request_scripts: [],
      comment: '',
      tags: ''
    });

    const createPayload = createRequest.mock.calls[0]?.[1] as { preRequestScript: string };
    expect(createPayload.preRequestScript).toBe('console.log(1);');
    expect(saved.pre_request_scripts).toHaveLength(1);
    expect(saved.pre_request_scripts[0]?.code).toBe('console.log(1);');
  });

  it('persists folder settings locally and returns them from listFolders', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440010';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440011';
    const folderRecord = {
      id: folderServerId,
      collectionId: collectionServerId,
      name: 'Users',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };

    const db = createStorage({
      renameFolder: vi.fn().mockResolvedValue(folderRecord),
      listFolders: vi.fn().mockResolvedValue([folderRecord]),
      deleteFolder: vi.fn().mockResolvedValue(undefined)
    });

    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);
    const folderId = idMap.toLocalId('folder', folderServerId);
    const variables = [
      { key: 'apiUrl', value: 'https://example.com', defaultValue: '', enabled: true, share: false }
    ];

    await db.updateFolder(
      folderId,
      'Users',
      variables,
      [{ key: 'X-Test', value: '1', enabled: true }],
      'console.log("pre");',
      '',
      { ...defaultAuth(), type: 'bearer', bearer: { token: 'folder-token' } },
      '',
      [createInlineScriptRef('console.log("pre");')],
      []
    );

    const folders = await db.listFolders(collectionId);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.variables).toEqual(variables);
    expect(folders[0]?.headers).toEqual([{ key: 'X-Test', value: '1', enabled: true }]);
    expect(folders[0]?.auth.type).toBe('bearer');
    expect(folders[0]?.pre_request_scripts).toHaveLength(1);
  });

  it('maps and mutates nested folders through Team Hub UUIDs', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440040';
    const parentServerId = '880e8400-e29b-41d4-a716-446655440041';
    const childServerId = '880e8400-e29b-41d4-a716-446655440042';
    const parentRecord = {
      id: parentServerId,
      collectionId: collectionServerId,
      parentFolderId: null,
      name: 'Parent',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const childRecord = {
      id: childServerId,
      collectionId: collectionServerId,
      parentFolderId: parentServerId,
      name: 'Child',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const createFolder = vi.fn().mockResolvedValue(childRecord);
    const moveFolder = vi.fn().mockResolvedValue(childRecord);
    const reorderFolders = vi.fn().mockResolvedValue(undefined);
    const deleteFolder = vi.fn().mockResolvedValue(undefined);
    const db = createStorage({
      listCollections: vi.fn().mockResolvedValue([
        {
          id: collectionServerId,
          name: 'Team API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          preRequestScript: '',
          postRequestScript: '',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ]),
      listFolders: vi.fn().mockResolvedValue([parentRecord, childRecord]),
      createFolder,
      moveFolder,
      reorderFolders,
      deleteFolder
    });
    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);
    const parentId = idMap.toLocalId('folder', parentServerId);
    const childId = idMap.toLocalId('folder', childServerId);

    const folders = await db.listFolders(collectionId);
    expect(folders.find((folder) => folder.id === childId)?.parent_folder_id).toBe(parentId);

    await db.createFolder(collectionId, 'Child', parentId);
    expect(createFolder).toHaveBeenCalledWith(collectionServerId, {
      name: 'Child',
      parentFolderId: parentServerId
    });

    await db.moveFolder(childId, parentId, 1);
    expect(moveFolder).toHaveBeenCalledWith(childServerId, {
      parentFolderId: parentServerId,
      sortOrder: 1
    });

    await db.reorderFolders(collectionId, parentId, [childId]);
    expect(reorderFolders).toHaveBeenCalledWith(collectionServerId, {
      parentFolderId: parentServerId,
      orderedFolderIds: [childServerId]
    });

    await db.deleteFolder(parentId);
    expect(deleteFolder).toHaveBeenCalledWith(parentServerId);
    expect(idMap.toServerId('folder', parentId)).toBeUndefined();
    expect(idMap.toServerId('folder', childId)).toBeUndefined();
  });

  it('removes local folder settings when deleteFolder runs', async () => {
    const collectionServerId = '770e8400-e29b-41d4-a716-446655440012';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440013';
    const folderRecord = {
      id: folderServerId,
      collectionId: collectionServerId,
      parentFolderId: null,
      name: 'Auth',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };

    const db = createStorage({
      listCollections: vi.fn().mockResolvedValue([
        {
          id: collectionServerId,
          name: 'Team API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          preRequestScript: '',
          postRequestScript: '',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ]),
      renameFolder: vi.fn().mockResolvedValue(folderRecord),
      listFolders: vi.fn().mockResolvedValue([folderRecord]),
      deleteFolder: vi.fn().mockResolvedValue(undefined)
    });

    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);
    const folderId = idMap.toLocalId('folder', folderServerId);

    await db.updateFolder(
      folderId,
      'Auth',
      [{ key: 'token', value: 'secret', defaultValue: '', enabled: true, share: false }],
      [],
      '',
      '',
      defaultAuth(),
      ''
    );

    await db.deleteFolder(folderId);

    const folders = await db.listFolders(collectionId);
    expect(folders[0]?.variables).toEqual([]);
  });

  it('includes folder settings in exportCollectionData', async () => {
    const collectionServerId = '550e8400-e29b-41d4-a716-446655440014';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440015';
    const folderRecord = {
      id: folderServerId,
      collectionId: collectionServerId,
      name: 'Billing',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };

    const db = createStorage({
      listCollections: vi.fn().mockResolvedValue([
        {
          id: collectionServerId,
          name: 'Team API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          preRequestScript: '',
          postRequestScript: '',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ]),
      renameFolder: vi.fn().mockResolvedValue(folderRecord),
      listFolders: vi.fn().mockResolvedValue([folderRecord]),
      listRequests: vi.fn().mockResolvedValue([])
    });

    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);
    const folderId = idMap.toLocalId('folder', folderServerId);
    const variables = [
      { key: 'plan', value: 'pro', defaultValue: '', enabled: true, share: false }
    ];

    await db.updateFolder(folderId, 'Billing', variables, [], '', '', defaultAuth(), '');

    const exported = await db.exportCollectionData(collectionId);
    expect(exported.folders ?? []).toHaveLength(1);
    expect(exported.folders?.[0]?.variables).toEqual([
      { key: 'plan', value: '', defaultValue: '', enabled: true, share: false }
    ]);
  });

  it('importCollectionData restores folder settings from export payload', async () => {
    const collectionServerId = '550e8400-e29b-41d4-a716-446655440020';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440021';
    const folderRecord = {
      id: folderServerId,
      collectionId: collectionServerId,
      name: 'Users',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const collectionRecord = {
      id: collectionServerId,
      name: 'Imported',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      preRequestScript: '',
      postRequestScript: '',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const variables = [
      { key: 'apiUrl', value: 'https://example.com', defaultValue: '', enabled: true, share: false }
    ];

    const db = createStorage({
      createCollection: vi.fn().mockResolvedValue(collectionRecord),
      updateCollection: vi.fn().mockResolvedValue({ ...collectionRecord, name: 'Imported' }),
      createFolder: vi.fn().mockResolvedValue(folderRecord),
      renameFolder: vi.fn().mockResolvedValue(folderRecord),
      listFolders: vi.fn().mockResolvedValue([folderRecord]),
      reorderFolders: vi.fn().mockResolvedValue(undefined)
    });

    const imported = await db.importCollectionData({
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: collectionServerId,
      name: 'Imported',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      folders: [
        {
          uuid: folderServerId,
          name: 'Users',
          sort_order: 0,
          variables,
          headers: [{ key: 'X-Test', value: '1', enabled: true }]
        }
      ],
      requests: []
    });

    const folders = await db.listFolders(imported.id);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.variables).toEqual(variables);
    expect(folders[0]?.headers).toEqual([{ key: 'X-Test', value: '1', enabled: true }]);
  });

  it('updateCollectionFromImport merges folder settings on existing folder uuid', async () => {
    const collectionServerId = '550e8400-e29b-41d4-a716-446655440022';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440023';
    const folderRecord = {
      id: folderServerId,
      collectionId: collectionServerId,
      name: 'Users',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const collectionRecord = {
      id: collectionServerId,
      name: 'Team API',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      preRequestScript: '',
      postRequestScript: '',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const updatedVariables = [
      { key: 'token', value: 'updated', defaultValue: '', enabled: true, share: false }
    ];

    const db = createStorage({
      updateCollection: vi.fn().mockResolvedValue(collectionRecord),
      renameFolder: vi.fn().mockResolvedValue(folderRecord),
      listFolders: vi.fn().mockResolvedValue([folderRecord]),
      reorderFolders: vi.fn().mockResolvedValue(undefined),
      listRequests: vi.fn().mockResolvedValue([])
    });

    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);
    const folderId = idMap.toLocalId('folder', folderServerId);

    await db.updateCollectionFromImport(collectionId, {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: collectionServerId,
      name: 'Team API',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      folders: [
        {
          uuid: folderServerId,
          name: 'Users',
          sort_order: 0,
          variables: updatedVariables
        }
      ],
      requests: []
    });

    const folders = await db.listFolders(collectionId);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.id).toBe(folderId);
    expect(folders[0]?.variables).toEqual(updatedVariables);
  });

  it('persists folder sidebar marker via renameFolder on the Team Hub server', async () => {
    const collectionServerId = '550e8400-e29b-41d4-a716-446655440030';
    const folderServerId = '880e8400-e29b-41d4-a716-446655440031';
    const folderRecord = {
      id: folderServerId,
      collectionId: collectionServerId,
      name: 'Billing',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      marker: '#ff5500'
    };
    const folderWithoutMarker = {
      id: folderServerId,
      collectionId: collectionServerId,
      name: 'Billing',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      marker: null
    };
    const renameFolder = vi.fn().mockResolvedValue(folderRecord);

    const db = createStorage({
      listCollections: vi.fn().mockResolvedValue([
        {
          id: collectionServerId,
          name: 'Team API',
          variables: [],
          headers: [],
          auth: defaultAuth(),
          preRequestScript: '',
          postRequestScript: '',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ]),
      renameFolder,
      listFolders: vi
        .fn()
        .mockResolvedValueOnce([folderWithoutMarker])
        .mockResolvedValue([folderRecord]),
      listRequests: vi.fn().mockResolvedValue([]),
      listDocuments: vi.fn().mockResolvedValue([])
    });

    const idMap = (db as unknown as { idMap: TeamHubIdMap }).idMap;
    const collectionId = idMap.toLocalId('collection', collectionServerId);
    const folderId = idMap.toLocalId('folder', folderServerId);

    const updated = await db.setFolderMarker(folderId, '#ff5500');
    expect(updated.marker).toBe('#ff5500');
    expect(renameFolder).toHaveBeenCalledWith(folderServerId, {
      name: 'Billing',
      marker: '#ff5500'
    });

    const folders = await db.listFolders(collectionId);
    expect(folders[0]?.marker).toBe('#ff5500');

    const exported = await db.exportCollectionData(collectionId);
    expect(exported.folders?.[0]?.marker).toBe('#ff5500');
  });

  it('maps snippet updatedAt and preserves list order from hub sortOrder', async () => {
    const firstId = '770e8400-e29b-41d4-a716-446655440010';
    const secondId = '770e8400-e29b-41d4-a716-446655440011';
    const listSnippets = vi.fn().mockResolvedValue([
      {
        id: firstId,
        name: 'First',
        code: 'a',
        scope: 'any',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-05T00:00:00.000Z',
        createdByUserId: null,
        updatedByUserId: null,
        deletionLocked: false
      },
      {
        id: secondId,
        name: 'Second',
        code: 'b',
        scope: 'any',
        sortOrder: 1,
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-06T00:00:00.000Z',
        createdByUserId: null,
        updatedByUserId: null,
        deletionLocked: false
      }
    ]);
    const db = createStorage({ listSnippets });

    const snippets = await db.listSnippets();
    expect(snippets).toHaveLength(2);
    expect(snippets[0]).toMatchObject({
      name: 'First',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-05T00:00:00.000Z'
    });
    expect(snippets[1]).toMatchObject({
      name: 'Second',
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-06T00:00:00.000Z'
    });
    expect(snippets.map((snippet) => snippet.name)).toEqual(['First', 'Second']);
  });

  it('maps live-server timestamps and sortOrder from hub payloads', async () => {
    const firstId = '880e8400-e29b-41d4-a716-446655440020';
    const secondId = '880e8400-e29b-41d4-a716-446655440021';
    const baseLiveServer = {
      root: '/tmp/docs',
      port: 4173,
      aliases: [],
      watch: true,
      cors: {
        enabled: false,
        origin: '*',
        methods: 'GET',
        allowedHeaders: '',
        exposedHeaders: '',
        maxAge: '600',
        credentials: false
      },
      openPath: '/',
      openPathOnStartup: true,
      rememberLastUrl: false,
      lastOpenedPath: null,
      indexFiles: ['index.html'],
      host: '127.0.0.1',
      headers: [],
      routes: [],
      errorPages: [],
      proxies: [],
      ssl: { enabled: false, certPath: '', keyPath: '' },
      runCommand: '',
      runtimeId: '',
      runCommandEnv: [],
      runCommandEnabled: false,
      restartOnCrash: false,
      urlVariable: '',
      preRequestScripts: [],
      postRequestScripts: [],
      createdByUserId: null,
      updatedByUserId: null,
      deletionLocked: false
    };
    const listLiveServers = vi.fn().mockResolvedValue([
      {
        ...baseLiveServer,
        id: firstId,
        name: 'Alpha',
        sortOrder: 2,
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-10T00:00:00.000Z'
      },
      {
        ...baseLiveServer,
        id: secondId,
        name: 'Beta',
        sortOrder: 5,
        createdAt: '2026-02-02T00:00:00.000Z',
        updatedAt: '2026-02-11T00:00:00.000Z'
      }
    ]);
    const createLiveServer = vi.fn().mockResolvedValue({
      ...baseLiveServer,
      id: '880e8400-e29b-41d4-a716-446655440022',
      name: 'Gamma',
      sortOrder: 2,
      createdAt: '2026-02-03T00:00:00.000Z',
      updatedAt: '2026-02-03T00:00:00.000Z'
    });
    const db = createStorage({ listLiveServers, createLiveServer });

    const listed = await db.listLiveServers();
    expect(listed.map((server) => ({ name: server.name, sortOrder: server.sortOrder }))).toEqual([
      { name: 'Alpha', sortOrder: 2 },
      { name: 'Beta', sortOrder: 5 }
    ]);
    expect(listed[0]?.createdAt).toBe(Date.parse('2026-02-01T00:00:00.000Z'));
    expect(listed[0]?.updatedAt).toBe(Date.parse('2026-02-10T00:00:00.000Z'));

    const created = await db.createLiveServer({
      name: 'Gamma',
      root: '/tmp/gamma'
    });
    expect(createLiveServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Gamma',
        root: '/tmp/gamma',
        sortOrder: 2
      })
    );
    expect(created).toMatchObject({
      name: 'Gamma',
      sortOrder: 2,
      createdAt: Date.parse('2026-02-03T00:00:00.000Z'),
      updatedAt: Date.parse('2026-02-03T00:00:00.000Z')
    });
  });
});
