import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it } from 'vitest';
import { LocalDatabase } from '#/main/storage/LocalDatabase';
import { TrashService } from '#/main/storage/TrashService';
import type { IStorage } from '#/main/storage/IStorage';
import { describeSqlite } from '#/test/nativeModules';

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Creates an isolated registry database for trash service tests.
 */
async function createRegistry(): Promise<{ database: LocalDatabase; rootDir: string }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-trash-'));
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

describeSqlite('TrashService registry entities', () => {
  it('moves an environment to trash and restores it', async () => {
    const { database } = await createRegistry();
    const environment = database.createEnvironment('QA');
    database.updateEnvironment(environment.id, 'QA', [
      { key: 'token', value: 'abc', defaultValue: '', share: false }
    ]);

    const trash = new TrashService({} as IStorage, database);
    await trash.moveEnvironmentToTrash(environment.id);

    expect(database.listEnvironments()).toEqual([]);
    expect(trash.listTrashItems()).toHaveLength(1);

    const restoredType = await trash.restoreTrashItem(trash.listTrashItems()[0]!.id);
    expect(restoredType).toBe('environment');
    expect(database.listEnvironments()).toEqual([
      expect.objectContaining({
        name: 'QA',
        variables: [{ key: 'token', value: 'abc', defaultValue: '', share: false }]
      })
    ]);
    expect(trash.listTrashItems()).toEqual([]);
  });

  it('moves a tab group to trash and restores it', async () => {
    const { database } = await createRegistry();
    const groups = database.createTabGroup({
      name: 'Morning',
      requests: [{ requestUuid: 'req-1', requestName: 'Health', collectionId: 1 }]
    });
    const tabGroupId = groups[0]!.id;

    const trash = new TrashService({} as IStorage, database);
    trash.moveTabGroupToTrash(tabGroupId);

    expect(database.listTabGroups()).toEqual([]);
    await trash.restoreTrashItem(trash.listTrashItems()[0]!.id);

    expect(database.listTabGroups()).toEqual([
      expect.objectContaining({
        name: 'Morning',
        requests: [
          expect.objectContaining({
            requestUuid: 'req-1',
            requestName: 'Health',
            collectionId: 1
          })
        ]
      })
    ]);
  });
});
