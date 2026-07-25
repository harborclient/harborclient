import { afterAll, beforeAll, expect, it } from 'vitest';
import { MySqlStorage } from './MySqlStorage';
import {
  closeSharedSqlBackends,
  createMySqlTestDbFactory,
  describeMySql,
  STORAGE_BACKEND_TEST_TIMEOUT_MS,
  warmMySqlTestBackend
} from '#/test/storageBackends';
import { runIstorageContractSuite } from '#/test/istorageContract';

describeMySql('MySqlStorage lifecycle', () => {
  it('throws when accessed before init', async () => {
    const db = new MySqlStorage({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'harborclient',
      database: 'harborclient_test'
    });
    await expect(db.listCollections()).rejects.toThrow('Database not initialized');
  });
});

describeMySql('MySqlStorage contract', { timeout: STORAGE_BACKEND_TEST_TIMEOUT_MS }, () => {
  beforeAll(async () => {
    await warmMySqlTestBackend();
  }, STORAGE_BACKEND_TEST_TIMEOUT_MS);

  runIstorageContractSuite('MySqlStorage', createMySqlTestDbFactory());
});

afterAll(async () => {
  await closeSharedSqlBackends();
});
