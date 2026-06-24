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

describeSqlite('LocalDatabase chats', () => {
  it('creates chats, stores messages, and auto-titles from the first user message', async () => {
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
    expect(loaded?.title).toBe('Hello there');
    expect(loaded?.messages).toHaveLength(2);
    expect(assistant.role).toBe('assistant');

    const summaries = database.listChats();
    expect(summaries[0]?.id).toBe(chat.id);

    database.deleteChat(chat.id);
    expect(database.getChat(chat.id)).toBeNull();
  });

  it('updates the stored model id for a chat', async () => {
    const { database } = await createRegistry();
    const chat = database.createChat({ model: 'gpt-4o-mini' });

    database.updateChatModel(chat.id, 'gpt-4o');
    expect(database.getChat(chat.id)?.model).toBe('gpt-4o');
  });
});
