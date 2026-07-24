import { GitStorage } from './GitStorage';
import { app } from 'electron';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import { isRandUserDirFlagEnabled } from '#/main/randUserDir';
import { FirestoreStorage } from './FirestoreStorage';
import { MySqlStorage } from './MySqlStorage';
import { PostgresStorage } from './PostgresStorage';
import { SqliteStorage } from './SqliteStorage';
import type { IStorage } from './IStorage';
import type { StorageConnection } from '@harborclient/core/types';

/**
 * Creates and initializes a database backend for a connection configuration.
 *
 * @param connection - Connection to instantiate.
 * @param userDataPath - Electron userData path for SQLite file storage.
 * @returns Initialized database instance.
 */
export async function createStorageInstance(
  connection: StorageConnection,
  userDataPath: string
): Promise<IStorage> {
  switch (connection.type) {
    case 'firestore': {
      const db = new FirestoreStorage(connection.settings);
      await db.init();
      return db;
    }
    case 'mysql': {
      const db = new MySqlStorage(connection.settings);
      await db.init();
      return db;
    }
    case 'postgres': {
      const db = new PostgresStorage(connection.settings);
      await db.init();
      return db;
    }
    case 'sqlite': {
      const appDataPath = isRandUserDirFlagEnabled() ? undefined : app.getPath('appData');
      const db = new SqliteStorage(userDataPath, connection.settings, appDataPath);
      await db.init();
      return db;
    }
    case 'git': {
      const db = new GitStorage(
        connection.id,
        connection.settings,
        userDataPath,
        () => getGeneralSettings().gitAutoAdd
      );
      await db.init();
      return db;
    }
  }
}
