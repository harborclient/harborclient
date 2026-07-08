import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it } from 'vitest';
import { LocalDatabase } from '#/main/storage/LocalDatabase';
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

    const created = database.createSnippet('Stable helper', 'return true;', 'any', uuid);
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
      catalogId: 'com.example.snippets.tester',
      catalogVersion: '1.0.1',
      catalogAuthor: 'HarborClient'
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Tester v2');
    expect(updated.catalogVersion).toBe('1.0.1');
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
