import { afterAll, expect, it } from 'vitest';
import { PostgresStorage } from './PostgresStorage';
import {
  closeSharedSqlBackends,
  createPostgresTestDbFactory,
  describePostgres
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

describePostgres('PostgresStorage contract', () => {
  runIstorageContractSuite('PostgresStorage', createPostgresTestDbFactory());
});

afterAll(async () => {
  await closeSharedSqlBackends();
});
