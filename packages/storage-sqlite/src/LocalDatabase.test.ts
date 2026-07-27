import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { DEFAULT_GIT_SIDEBAR_EXPANSION } from '@harborclient/core/gitSidebarExpansion';
import { defaultSidebarExpansion } from '@harborclient/core/sidebarExpansion';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '@harborclient/core/types';
import type { WorkspaceLayout } from '@harborclient/core/types/workspace';
import { LocalDatabase } from './LocalDatabase';
import { describeSqlite } from '#/test/nativeModules';

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Creates an isolated registry database for tests.
 */
async function createRegistry(): Promise<{ database: LocalDatabase; rootDir: string }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-registry-'));
  const database = new LocalDatabase(rootDir);
  await database.init();
  cleanups.push(async () => {
    await database.close();
    rmSync(rootDir, { recursive: true, force: true });
  });
  return { database, rootDir };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describeSqlite('LocalDatabase collection order', () => {
  it('lists new entries by insertion order rather than name', async () => {
    const { database } = await createRegistry();
    database.addRegistryEntry({ name: 'Zulu', connectionId: 'conn-a', providerCollectionId: 1 });
    database.addRegistryEntry({ name: 'Alpha', connectionId: 'conn-a', providerCollectionId: 2 });

    expect(database.listRegistry().map((entry) => entry.name)).toEqual(['Zulu', 'Alpha']);
  });

  it('reorderRegistry persists sidebar order', async () => {
    const { database } = await createRegistry();
    const alpha = database.addRegistryEntry({
      name: 'Alpha',
      connectionId: 'conn-a',
      providerCollectionId: 1
    });
    const beta = database.addRegistryEntry({
      name: 'Beta',
      connectionId: 'conn-a',
      providerCollectionId: 2
    });
    const gamma = database.addRegistryEntry({
      name: 'Gamma',
      connectionId: 'conn-a',
      providerCollectionId: 3
    });

    expect(database.listRegistry().map((entry) => entry.name)).toEqual(['Alpha', 'Beta', 'Gamma']);

    database.reorderRegistry([gamma.id, alpha.id, beta.id]);
    expect(database.listRegistry().map((entry) => entry.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });
});

describeSqlite('LocalDatabase collection archive', () => {
  it('defaults new registry entries to not archived', async () => {
    const { database } = await createRegistry();
    const entry = database.addRegistryEntry({
      name: 'Alpha',
      connectionId: 'conn-a',
      providerCollectionId: 1
    });

    expect(entry.archived).toBe(false);
    expect(database.getRegistryEntry(entry.id)?.archived).toBe(false);
  });

  it('setRegistryArchived round-trips the archived flag', async () => {
    const { database } = await createRegistry();
    const entry = database.addRegistryEntry({
      name: 'Alpha',
      connectionId: 'conn-a',
      providerCollectionId: 1
    });

    const archived = database.setRegistryArchived(entry.id, true);
    expect(archived.archived).toBe(true);
    expect(database.listRegistry().find((item) => item.id === entry.id)?.archived).toBe(true);

    const restored = database.setRegistryArchived(entry.id, false);
    expect(restored.archived).toBe(false);
    expect(database.getRegistryEntry(entry.id)?.archived).toBe(false);
  });

  it('migrates legacy registry databases missing the archived column', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-registry-legacy-'));
    const Database = (await import('better-sqlite3')).default;
    const legacy = new Database(join(rootDir, 'harborclient-registry.db'));
    legacy.exec(`
      CREATE TABLE collection_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        collection_uuid TEXT NOT NULL DEFAULT '',
        connection_id TEXT NOT NULL,
        provider_collection_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    legacy
      .prepare(
        `INSERT INTO collection_registry (name, collection_uuid, connection_id, provider_collection_id, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('Legacy', 'legacy-uuid', 'conn-a', 1, 0);
    legacy.close();

    const database = new LocalDatabase(rootDir);
    await database.init();
    cleanups.push(async () => {
      await database.close();
      rmSync(rootDir, { recursive: true, force: true });
    });

    const entries = database.listRegistry();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe('Legacy');
    expect(entries[0]?.archived).toBe(false);

    const updated = database.setRegistryArchived(entries[0]!.id, true);
    expect(updated.archived).toBe(true);
  });
});

describeSqlite('LocalDatabase environment order', () => {
  it('lists new environments by insertion order rather than name', async () => {
    const { database } = await createRegistry();
    database.createEnvironment('Zulu');
    database.createEnvironment('Alpha');

    expect(database.listEnvironments().map((environment) => environment.name)).toEqual([
      'Zulu',
      'Alpha'
    ]);
  });

  it('reorderEnvironments persists sidebar order', async () => {
    const { database } = await createRegistry();
    const alpha = database.createEnvironment('Alpha');
    const beta = database.createEnvironment('Beta');
    const gamma = database.createEnvironment('Gamma');

    expect(database.listEnvironments().map((environment) => environment.name)).toEqual([
      'Alpha',
      'Beta',
      'Gamma'
    ]);

    database.reorderEnvironments([gamma.id, alpha.id, beta.id]);
    expect(database.listEnvironments().map((environment) => environment.name)).toEqual([
      'Gamma',
      'Alpha',
      'Beta'
    ]);
  });
});

describeSqlite('LocalDatabase chats', () => {
  it('creates chats, stores messages, and keeps the default title until updated', async () => {
    const { database } = await createRegistry();

    const chat = database.createChat({});
    expect(chat.title).toBe('New Chat');
    expect(chat.messages).toEqual([]);
    expect(chat.message_count).toBe(0);

    database.addChatMessage({ chatId: chat.id, role: 'user', content: '  Hello there  ' });
    const assistant = database.addChatMessage({
      chatId: chat.id,
      role: 'assistant',
      content: 'Stub reply'
    });

    const loaded = database.getChat(chat.id);
    expect(loaded?.title).toBe('New Chat');
    expect(loaded?.messages).toHaveLength(2);
    expect(assistant.role).toBe('assistant');

    const summaries = database.listChats();
    expect(summaries[0]?.id).toBe(chat.id);
    expect(summaries[0]?.message_count).toBe(2);

    const emptyChat = database.createChat({});
    const summariesWithEmpty = database.listChats();
    expect(summariesWithEmpty.find((summary) => summary.id === emptyChat.id)?.message_count).toBe(
      0
    );

    database.deleteChat(chat.id);
    expect(database.getChat(chat.id)).toBeNull();
  });

  it('updates a chat title', async () => {
    const { database } = await createRegistry();
    const chat = database.createChat({});

    database.updateChatTitle(chat.id, 'OAuth token refresh');
    expect(database.getChat(chat.id)?.title).toBe('OAuth token refresh');
  });

  it('updates the stored model id for a chat', async () => {
    const { database } = await createRegistry();
    const chat = database.createChat({ model: 'gpt-4o-mini' });

    database.updateChatModel(chat.id, 'gpt-4o');
    expect(database.getChat(chat.id)?.model).toBe('gpt-4o');
  });

  it('persists and reloads reference snapshots on chat messages', async () => {
    const { database } = await createRegistry();
    const chat = database.createChat({});
    const token = '@res.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.body';
    const referenceSnapshots = {
      [token]: {
        kind: 'response-section' as const,
        snapshot: {
          label: 'Response body',
          requestName: 'Echo',
          section: 'body' as const,
          status: 200,
          statusText: 'OK',
          content: '{"ok":true}'
        }
      }
    };

    const saved = database.addChatMessage({
      chatId: chat.id,
      role: 'user',
      content: `Explain ${token}`,
      referenceSnapshots
    });

    expect(saved.referenceSnapshots).toEqual(referenceSnapshots);

    const loaded = database.getChat(chat.id);
    expect(loaded?.messages[0]?.referenceSnapshots).toEqual(referenceSnapshots);
  });
});

describeSqlite('LocalDatabase snippets', () => {
  it('creates, lists, updates, and deletes snippets', async () => {
    const { database } = await createRegistry();

    expect(database.listSnippets()).toEqual([]);

    const created = database.createSnippet('Auth helper', 'console.log("auth");', 'pre-request');
    expect(created.name).toBe('Auth helper');
    expect(created.code).toBe('console.log("auth");');
    expect(created.scope).toBe('pre-request');
    expect(created.source).toBe('local');
    expect(created.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(created.created_at).toBeTruthy();
    expect(created.updated_at).toBeTruthy();

    database.createSnippet('Second snippet', 'return true;');
    expect(database.listSnippets().map((snippet) => snippet.name)).toEqual([
      'Auth helper',
      'Second snippet'
    ]);

    const updated = database.updateSnippet(
      created.id,
      'Auth helper v2',
      'console.log("v2");',
      'post-request'
    );
    expect(updated.id).toBe(created.id);
    expect(updated.uuid).toBe(created.uuid);
    expect(updated.name).toBe('Auth helper v2');
    expect(updated.code).toBe('console.log("v2");');
    expect(updated.scope).toBe('post-request');
    expect(updated.updated_at >= created.updated_at).toBe(true);

    database.deleteSnippet(created.id);
    expect(database.listSnippets().map((snippet) => snippet.name)).toEqual(['Second snippet']);
  });

  it('throws when updating a missing snippet', async () => {
    const { database } = await createRegistry();

    expect(() => database.updateSnippet(999, 'Missing', 'code', 'any')).toThrow(
      'Snippet not found'
    );
  });

  it('defaults scope to any when omitted on create', async () => {
    const { database } = await createRegistry();

    const created = database.createSnippet('Generic helper', 'return true;');
    expect(created.scope).toBe('any');
    expect(created.source).toBe('local');
  });

  it('preserves a provided uuid on create', async () => {
    const { database } = await createRegistry();
    const uuid = '22222222-2222-4222-8222-222222222222';

    const created = database.createSnippet('Stable helper', 'return true;', 'any', 'main', uuid);
    expect(created.uuid).toBe(uuid);
  });

  it('upserts, lists, and deletes marketplace snippets by catalog id', async () => {
    const { database } = await createRegistry();
    const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    const created = database.upsertMarketplaceSnippet({
      uuid,
      name: 'Tester',
      code: 'hc.test("ok", () => true);',
      scope: 'post-request',
      stage: 'main',
      catalogId: 'com.example.snippets.tester',
      catalogVersion: '1.0.0',
      catalogAuthor: 'HarborClient'
    });

    expect(created.source).toBe('marketplace');
    expect(created.catalogId).toBe('com.example.snippets.tester');
    expect(created.catalogVersion).toBe('1.0.0');
    expect(created.catalogAuthor).toBe('HarborClient');

    const updated = database.upsertMarketplaceSnippet({
      uuid,
      name: 'Tester v2',
      code: 'hc.test("ok", () => response.status === 200);',
      scope: 'post-request',
      stage: 'before-each',
      catalogId: 'com.example.snippets.tester',
      catalogVersion: '1.0.1',
      catalogAuthor: 'HarborClient'
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Tester v2');
    expect(updated.catalogVersion).toBe('1.0.1');
    expect(updated.stage).toBe('before-each');
    expect(database.listMarketplaceSnippetsByCatalogId('com.example.snippets.tester')).toHaveLength(
      1
    );

    database.deleteSnippetsByCatalogId('com.example.snippets.tester');
    expect(database.listMarketplaceSnippetsByCatalogId('com.example.snippets.tester')).toEqual([]);
  });

  it('backfills missing catalog author and ensures marketplace source for bundle rows', async () => {
    const { database } = await createRegistry();
    const catalogId = 'com.example.snippets.backfill';

    database.upsertMarketplaceSnippet({
      uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      name: 'Legacy import',
      code: 'hc.test("ok", () => true);',
      scope: 'any',
      stage: 'main',
      catalogId,
      catalogVersion: '1.0.0'
    });

    const before = database.listMarketplaceSnippetsByCatalogId(catalogId)[0];
    expect(before?.catalogAuthor).toBeUndefined();
    expect(before?.source).toBe('marketplace');

    database.backfillCatalogAuthor(catalogId, 'HarborClient');
    const afterAuthor = database.listMarketplaceSnippetsByCatalogId(catalogId)[0];
    expect(afterAuthor?.catalogAuthor).toBe('HarborClient');

    const internalDb = (
      database as unknown as { getDb(): import('better-sqlite3').Database }
    ).getDb();
    internalDb.prepare("UPDATE snippets SET source = 'local' WHERE catalog_id = ?").run(catalogId);
    database.ensureMarketplaceSource(catalogId);
    const afterSource = database.listMarketplaceSnippetsByCatalogId(catalogId)[0];
    expect(afterSource?.source).toBe('marketplace');
    expect(afterSource?.catalogAuthor).toBe('HarborClient');
  });
});

describeSqlite('LocalDatabase request history', () => {
  it('persists, lists newest-first, and prunes beyond the cap', async () => {
    const { database } = await createRegistry();

    for (let index = 0; index < 3; index += 1) {
      database.addRequestHistory(
        {
          id: 1_000 + index,
          method: 'GET',
          url: `https://example.com/${index}`,
          status: 200,
          statusText: 'OK',
          ts: 1_000 + index,
          name: `Request ${index}`
        },
        2
      );
    }

    const items = database.listRequestHistory(2);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.name)).toEqual(['Request 2', 'Request 1']);
  });

  it('clears all persisted request history entries', async () => {
    const { database } = await createRegistry();

    database.addRequestHistory({
      id: 42,
      method: 'POST',
      url: 'https://example.com',
      status: 201,
      statusText: 'Created',
      ts: Date.now(),
      name: 'Create item'
    });

    expect(database.listRequestHistory()).toHaveLength(1);
    database.clearRequestHistory();
    expect(database.listRequestHistory()).toEqual([]);
  });

  it('persists run entries with collection runner target metadata', async () => {
    const { database } = await createRegistry();

    database.addRequestHistory({
      id: 99,
      kind: 'run',
      method: 'POST',
      url: '',
      status: 0,
      statusText: '',
      ts: 2_000,
      name: 'HarborClient Echo',
      runCollectionId: 10,
      runFolderId: null,
      runRequestId: null
    });

    expect(database.listRequestHistory()).toEqual([
      {
        id: 99,
        kind: 'run',
        method: 'POST',
        url: '',
        status: 0,
        statusText: '',
        ts: 2_000,
        name: 'HarborClient Echo',
        runCollectionId: 10,
        runFolderId: null,
        runRequestId: null,
        headers: {},
        params: [],
        body: undefined,
        bodyType: undefined,
        savedRequestId: undefined,
        responseHeaders: undefined,
        responseBody: undefined
      }
    ]);
  });

  it('persists response headers and body for Diff', async () => {
    const { database } = await createRegistry();

    database.addRequestHistory({
      id: 7,
      method: 'GET',
      url: 'https://example.com/items',
      status: 200,
      statusText: 'OK',
      ts: 3_000,
      name: 'List items',
      responseHeaders: { 'content-type': 'application/json' },
      responseBody: '{"ok":true}'
    });

    const [entry] = database.listRequestHistory();
    expect(entry?.responseHeaders).toEqual({ 'content-type': 'application/json' });
    expect(entry?.responseBody).toBe('{"ok":true}');
  });

  it('deletes one persisted request history entry by id', async () => {
    const { database } = await createRegistry();

    database.addRequestHistory({
      id: 1,
      method: 'GET',
      url: 'https://example.com/one',
      status: 200,
      statusText: 'OK',
      ts: 1,
      name: 'One'
    });
    database.addRequestHistory({
      id: 2,
      method: 'GET',
      url: 'https://example.com/two',
      status: 200,
      statusText: 'OK',
      ts: 2,
      name: 'Two'
    });

    const remaining = database.deleteRequestHistory(1);

    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(2);
  });
});

describeSqlite('LocalDatabase workspaces', () => {
  it('migrates legacy tab_groups tables and trash snapshots to workspaces', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-registry-legacy-'));
    const dbPath = join(rootDir, 'harborclient-registry.db');
    const seed = new Database(dbPath);
    seed.exec(`
      CREATE TABLE tab_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        marker TEXT
      );
      CREATE TABLE tab_group_requests (
        group_id INTEGER NOT NULL REFERENCES tab_groups(id) ON DELETE CASCADE,
        request_uuid TEXT NOT NULL,
        collection_id INTEGER,
        request_name TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (group_id, request_uuid)
      );
      CREATE TABLE trash_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        label TEXT NOT NULL,
        connection_id TEXT,
        original_ids TEXT NOT NULL,
        payload TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    seed
      .prepare(
        'INSERT INTO tab_groups (name, sort_order, created_at, updated_at, marker) VALUES (?, 0, 1, 1, ?)'
      )
      .run('Auth', '#ff0000');
    seed
      .prepare(
        'INSERT INTO tab_group_requests (group_id, request_uuid, request_name, sort_order) VALUES (1, ?, ?, 0)'
      )
      .run('uuid-1', 'Login');
    seed
      .prepare(
        `INSERT INTO trash_items (entity_type, label, original_ids, payload) VALUES ('tabGroup', 'Old', ?, ?)`
      )
      .run(
        JSON.stringify({ tabGroupId: 9 }),
        JSON.stringify({
          tabGroup: { id: 9, name: 'Old', requests: [], createdAt: 1, updatedAt: 1 }
        })
      );
    seed.close();

    const database = new LocalDatabase(rootDir);
    await database.init();
    cleanups.push(async () => {
      await database.close();
      rmSync(rootDir, { recursive: true, force: true });
    });

    const workspaces = database.listWorkspaces();
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({
      name: 'Auth',
      marker: '#ff0000',
      requests: [{ requestUuid: 'uuid-1', requestName: 'Login' }]
    });

    const trash = database.listTrashItems();
    expect(trash[0]?.entityType).toBe('workspace');
    expect(trash[0]?.originalIds).toEqual({ workspaceId: 9 });
    expect(trash[0]?.payload).toEqual({
      workspace: { id: 9, name: 'Old', requests: [], createdAt: 1, updatedAt: 1 }
    });

    const verify = new Database(dbPath);
    const tableNames = (
      verify.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);
    expect(tableNames).toContain('workspaces');
    expect(tableNames).toContain('workspace_requests');
    expect(tableNames).not.toContain('tab_groups');
    expect(tableNames).not.toContain('tab_group_requests');
    const requestColumns = (
      verify.prepare('PRAGMA table_info(workspace_requests)').all() as Array<{ name: string }>
    ).map((column) => column.name);
    expect(requestColumns).toContain('workspace_id');
    expect(requestColumns).not.toContain('group_id');
    verify.close();
  });

  it('creates, lists, renames, clones, and deletes workspaces', async () => {
    const { database } = await createRegistry();

    const created = database.createWorkspace({
      name: 'Auth flows',
      requests: [
        { requestUuid: 'uuid-1', collectionId: 1, requestName: 'Login' },
        { requestUuid: 'uuid-2', collectionId: 1, requestName: 'Refresh' }
      ]
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      name: 'Auth flows',
      requests: [
        { requestUuid: 'uuid-1', collectionId: 1, requestName: 'Login' },
        { requestUuid: 'uuid-2', collectionId: 1, requestName: 'Refresh' }
      ]
    });

    const renamed = database.renameWorkspace(created[0]!.id, 'Auth');
    expect(renamed[0]?.name).toBe('Auth');

    const updated = database.updateWorkspace(created[0]!.id, [
      { requestUuid: 'uuid-2', collectionId: 1, requestName: 'Refresh' },
      { requestUuid: 'uuid-3', collectionId: 2, requestName: 'Logout' }
    ]);
    expect(updated[0]?.requests).toEqual([
      { requestUuid: 'uuid-2', collectionId: 1, requestName: 'Refresh' },
      { requestUuid: 'uuid-3', collectionId: 2, requestName: 'Logout' }
    ]);

    const cloned = database.cloneWorkspace(created[0]!.id, 'Auth copy');
    expect(cloned).toHaveLength(2);
    expect(cloned[1]?.name).toBe('Auth copy');
    expect(cloned[1]?.requests).toEqual(updated[0]?.requests);

    const remaining = database.deleteWorkspace(created[0]!.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.name).toBe('Auth copy');
  });

  it('reorderWorkspaces persists sidebar order', async () => {
    const { database } = await createRegistry();

    const first = database.createWorkspace({
      name: 'Alpha',
      requests: [{ requestUuid: 'uuid-1' }]
    });
    const second = database.createWorkspace({
      name: 'Beta',
      requests: [{ requestUuid: 'uuid-2' }]
    });
    const third = database.createWorkspace({
      name: 'Gamma',
      requests: [{ requestUuid: 'uuid-3' }]
    });

    const ids = [first[0]!.id, second[1]!.id, third[2]!.id];
    const reordered = database.reorderWorkspaces([ids[2]!, ids[0]!, ids[1]!]);

    expect(reordered.map((group) => group.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('persists, updates, and clones workspace layout snapshots', async () => {
    const { database } = await createRegistry();

    const layout: WorkspaceLayout = {
      panels: {
        showSidebar: true,
        showAiSidebar: false,
        showGitSidebar: false,
        showRequestEditor: true,
        showResponseEditor: true,
        requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
        showConsole: false,
        showVariables: true,
        showMcp: false,
        showTerminal: false,
        activePluginFooterPanelId: null
      },
      panelSizes: { 'hc.sidebarWidth': 480 },
      sidebarExpansion: defaultSidebarExpansion(),
      gitSidebar: {
        sections: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections },
        sectionVisibility: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility }
      },
      activeEnvironmentUuid: 'env-uuid',
      theme: 'dark'
    };

    const created = database.createWorkspace({
      name: 'Layouted',
      requests: [{ requestUuid: 'uuid-1' }],
      layout
    });

    expect(created[0]?.layout).toMatchObject({
      theme: 'dark',
      activeEnvironmentUuid: 'env-uuid',
      panelSizes: { 'hc.sidebarWidth': 480 },
      panels: expect.objectContaining({ showVariables: true })
    });

    const withoutLayout = database.createWorkspace({
      name: 'Legacy shape',
      requests: [{ requestUuid: 'uuid-2' }]
    });
    expect(withoutLayout.find((group) => group.name === 'Legacy shape')?.layout).toBeNull();

    const nextLayout = {
      ...layout,
      theme: 'light' as const,
      panelSizes: { 'hc.sidebarWidth': 320, 'hc.consoleHeight': 200 }
    };
    const updated = database.updateWorkspace(
      created[0]!.id,
      [{ requestUuid: 'uuid-1' }],
      nextLayout
    );
    expect(updated[0]?.layout?.theme).toBe('light');
    expect(updated[0]?.layout?.panelSizes).toEqual({
      'hc.sidebarWidth': 320,
      'hc.consoleHeight': 200
    });

    const cloned = database.cloneWorkspace(created[0]!.id, 'Layouted copy');
    const copy = cloned.find((group) => group.name === 'Layouted copy');
    expect(copy?.layout?.theme).toBe('light');
    expect(copy?.layout?.panelSizes['hc.sidebarWidth']).toBe(320);
  });
});

describeSqlite('LocalDatabase trash items', () => {
  it('inserts, lists, and deletes trash snapshot rows', async () => {
    const { database } = await createRegistry();
    const inserted = database.insertTrashItem({
      entityType: 'environment',
      label: 'Staging',
      originalIds: { environmentId: 3 },
      payload: { environment: { id: 3, name: 'Staging', uuid: 'env-1', variables: [] } }
    });

    expect(database.listTrashItems()).toEqual([
      expect.objectContaining({
        id: inserted.id,
        entityType: 'environment',
        label: 'Staging'
      })
    ]);

    database.deleteTrashItem(inserted.id);
    expect(database.listTrashItems()).toEqual([]);
  });

  it('clears all trash snapshot rows', async () => {
    const { database } = await createRegistry();
    database.insertTrashItem({
      entityType: 'history',
      label: 'GET /health',
      originalIds: { historyId: 1 },
      payload: {
        entry: { id: 1, method: 'GET', url: '/health', status: 200, statusText: 'OK', ts: 1 }
      }
    });
    database.insertTrashItem({
      entityType: 'workspace',
      label: 'Tabs',
      originalIds: { workspaceId: 2 },
      payload: { workspace: { id: 2, name: 'Tabs', requests: [], createdAt: 1, updatedAt: 1 } }
    });

    database.clearTrash();
    expect(database.listTrashItems()).toEqual([]);
  });
});
