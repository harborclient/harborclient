import { FirestoreDatabase } from '#/main/db/FirestoreDatabase';
import { MySqlDatabase } from '#/main/db/MySqlDatabase';
import { PostgresDatabase } from '#/main/db/PostgresDatabase';
import { SqliteDatabase } from '#/main/db/SqliteDatabase';
import type { IDatabase } from '#/main/db/IDatabase';
import type { DatabaseConnection } from '#/shared/types';

/**
 * Creates and initializes a database backend for a connection configuration.
 *
 * @param connection - Connection to instantiate.
 * @param userDataPath - Electron userData path for SQLite file storage.
 * @returns Initialized database instance.
 */
export async function createDatabaseInstance(
  connection: DatabaseConnection,
  userDataPath: string
): Promise<IDatabase> {
  switch (connection.type) {
    case 'firestore': {
      const db = new FirestoreDatabase(connection.settings);
      await db.init();
      return db;
    }
    case 'mysql': {
      const db = new MySqlDatabase(connection.settings);
      await db.init();
      return db;
    }
    case 'postgres': {
      const db = new PostgresDatabase(connection.settings);
      await db.init();
      return db;
    }
    case 'sqlite': {
      const db = new SqliteDatabase(userDataPath, connection.settings);
      await db.init();
      return db;
    }
  }
}
