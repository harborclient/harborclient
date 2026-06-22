import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it } from 'vitest';
import { LocalRegistry } from '#/main/db/LocalRegistry';
import { describeSqlite } from '#/test/nativeModules';

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Creates an isolated registry database for tests.
 */
async function createRegistry(): Promise<{ registry: LocalRegistry; rootDir: string }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-registry-'));
  const registry = new LocalRegistry(rootDir);
  await registry.init();
  cleanups.push(async () => {
    await registry.close();
    rmSync(rootDir, { recursive: true, force: true });
  });
  return { registry, rootDir };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describeSqlite('LocalRegistry collection order', () => {
  it('lists new entries by insertion order rather than name', async () => {
    const { registry } = await createRegistry();
    registry.addRegistryEntry({ name: 'Zulu', connectionId: 'conn-a', providerCollectionId: 1 });
    registry.addRegistryEntry({ name: 'Alpha', connectionId: 'conn-a', providerCollectionId: 2 });

    expect(registry.listRegistry().map((entry) => entry.name)).toEqual(['Zulu', 'Alpha']);
  });

  it('reorderRegistry persists sidebar order', async () => {
    const { registry } = await createRegistry();
    const alpha = registry.addRegistryEntry({
      name: 'Alpha',
      connectionId: 'conn-a',
      providerCollectionId: 1
    });
    const beta = registry.addRegistryEntry({
      name: 'Beta',
      connectionId: 'conn-a',
      providerCollectionId: 2
    });
    const gamma = registry.addRegistryEntry({
      name: 'Gamma',
      connectionId: 'conn-a',
      providerCollectionId: 3
    });

    expect(registry.listRegistry().map((entry) => entry.name)).toEqual(['Alpha', 'Beta', 'Gamma']);

    registry.reorderRegistry([gamma.id, alpha.id, beta.id]);
    expect(registry.listRegistry().map((entry) => entry.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });
});

describeSqlite('LocalRegistry chats', () => {
  it('creates chats, stores messages, and auto-titles from the first user message', async () => {
    const { registry } = await createRegistry();

    const chat = registry.createChat({});
    expect(chat.title).toBe('New Chat');
    expect(chat.messages).toEqual([]);

    registry.addChatMessage({ chatId: chat.id, role: 'user', content: '  Hello there  ' });
    const assistant = registry.addChatMessage({
      chatId: chat.id,
      role: 'assistant',
      content: 'Stub reply'
    });

    const loaded = registry.getChat(chat.id);
    expect(loaded?.title).toBe('Hello there');
    expect(loaded?.messages).toHaveLength(2);
    expect(assistant.role).toBe('assistant');

    const summaries = registry.listChats();
    expect(summaries[0]?.id).toBe(chat.id);

    registry.deleteChat(chat.id);
    expect(registry.getChat(chat.id)).toBeNull();
  });
});
