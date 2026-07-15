export { FirestoreStorage } from './FirestoreStorage';
export { MySqlStorage } from './MySqlStorage';
export { PostgresStorage } from './PostgresStorage';
export { SqliteStorage } from './SqliteStorage';
export { LocalDatabase } from './LocalDatabase';
export {
  clearLocalDatabaseForTesting,
  getLocalDatabase,
  initLocalDatabase,
  setLocalDatabaseForTesting
} from './localDatabaseInstance';
export { RoutingStorage } from './RoutingStorage';
export { createStorageInstance } from './createStorageInstance';
export type { IStorage } from './IStorage';
