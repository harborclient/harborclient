export { FirestoreStorage } from '#/main/storage/FirestoreStorage';
export { MySqlStorage } from '#/main/storage/MySqlStorage';
export { PostgresStorage } from '#/main/storage/PostgresStorage';
export { SqliteStorage } from '#/main/storage/SqliteStorage';
export { LocalDatabase } from '#/main/storage/LocalDatabase';
export {
  clearLocalDatabaseForTesting,
  getLocalDatabase,
  initLocalDatabase,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
export { RoutingStorage } from '#/main/storage/RoutingStorage';
export { createStorageInstance } from '#/main/storage/createStorageInstance';
export type { IStorage } from '#/main/storage/IStorage';
