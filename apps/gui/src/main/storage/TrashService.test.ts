import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it } from 'vitest';
import { LocalDatabase } from './LocalDatabase';
import { TrashService } from './TrashService';
import type { IStorage } from './IStorage';
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
      { key: 'token', value: 'abc', defaultValue: '', enabled: true, share: false }
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
        variables: [{ key: 'token', value: 'abc', defaultValue: '', enabled: true, share: false }]
      })
    ]);
    expect(trash.listTrashItems()).toEqual([]);
  });

  it('moves a workspace to trash and restores it', async () => {
    const { database } = await createRegistry();
    const groups = database.createWorkspace({
      name: 'Morning',
      requests: [{ requestUuid: 'req-1', requestName: 'Health', collectionId: 1 }]
    });
    const workspaceId = groups[0]!.id;

    const trash = new TrashService({} as IStorage, database);
    trash.moveWorkspaceToTrash(workspaceId);

    expect(database.listWorkspaces()).toEqual([]);
    await trash.restoreTrashItem(trash.listTrashItems()[0]!.id);

    expect(database.listWorkspaces()).toEqual([
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

  it('moves a workflow to trash and restores it', async () => {
    const { database } = await createRegistry();
    const workflows = database.createWorkflow({
      name: 'Recorded send',
      uuid: 'wf-trash-1',
      durationMs: 1_500,
      variables: { env: 'dev' },
      actions: [{ uuid: 'action-send', type: 'request.send', at: 20, payload: { uuid: 'req-9' } }]
    });
    const workflowId = workflows[0]!.id;

    const trash = new TrashService({} as IStorage, database);
    trash.moveWorkflowToTrash(workflowId);

    expect(database.listWorkflows()).toEqual([]);
    expect(trash.listTrashItems()[0]?.entityType).toBe('workflow');

    const restoredType = await trash.restoreTrashItem(trash.listTrashItems()[0]!.id);
    expect(restoredType).toBe('workflow');
    expect(database.listWorkflows()).toEqual([
      expect.objectContaining({
        name: 'Recorded send',
        uuid: 'wf-trash-1',
        durationMs: 1_500,
        variables: { env: 'dev' },
        actions: [{ uuid: 'action-send', type: 'request.send', at: 20, payload: { uuid: 'req-9' } }]
      })
    ]);
    expect(trash.listTrashItems()).toEqual([]);
  });
});
