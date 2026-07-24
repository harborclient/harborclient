import { afterAll, expect, it } from 'vitest';
import { MySqlStorage } from './MySqlStorage';
import {
  closeSharedSqlBackends,
  createMySqlTestDbFactory,
  describeMySql
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

describeMySql('MySqlStorage contract', () => {
  runIstorageContractSuite('MySqlStorage', createMySqlTestDbFactory());
});

afterAll(async () => {
  await closeSharedSqlBackends();
});
