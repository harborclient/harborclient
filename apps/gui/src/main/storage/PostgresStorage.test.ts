import { afterAll, beforeAll, expect, it } from 'vitest';
import { PostgresStorage } from './PostgresStorage';
import {
  closeSharedSqlBackends,
  createPostgresTestDbFactory,
  describePostgres,
  STORAGE_BACKEND_TEST_TIMEOUT_MS,
  warmPostgresTestBackend
} from '#/test/storageBackends';
import { runIstorageContractSuite } from '#/test/istorageContract';

describePostgres('PostgresStorage lifecycle', () => {
  it('throws when accessed before init', async () => {
    const db = new PostgresStorage({
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      password: 'harborclient',
      database: 'harborclient_test'
    });
    await expect(db.listCollections()).rejects.toThrow('Database not initialized');
  });
});

describePostgres('PostgresStorage contract', { timeout: STORAGE_BACKEND_TEST_TIMEOUT_MS }, () => {
  beforeAll(async () => {
    await warmPostgresTestBackend();
  }, STORAGE_BACKEND_TEST_TIMEOUT_MS);

  runIstorageContractSuite('PostgresStorage', createPostgresTestDbFactory());
});

afterAll(async () => {
  await closeSharedSqlBackends();
});
