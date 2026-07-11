import mysql from 'mysql2/promise';
import { Pool } from 'pg';
import { describe } from 'vitest';
import { FirestoreStorage } from '#/main/storage/FirestoreStorage';
import { MySqlStorage } from '#/main/storage/MySqlStorage';
import { PostgresStorage } from '#/main/storage/PostgresStorage';
import type { FirestoreSettings, MySqlSettings, PostgresSettings } from '#/shared/types';
import type { CreateTestDb } from '#/test/istorageContract';

function isCi(): boolean {
  return process.env.CI === 'true';
}

function mysqlConfigured(): boolean {
  return isCi() || process.env.HARBOR_TEST_MYSQL_HOST != null;
}

function postgresConfigured(): boolean {
  return isCi() || process.env.HARBOR_TEST_POSTGRES_HOST != null;
}

function firestoreEmulatorConfigured(): boolean {
  return process.env.FIRESTORE_EMULATOR_HOST != null;
}

function gatedDescribe(available: () => boolean, moduleName: string): typeof describe {
  const loadable = available();
  if (!loadable && isCi()) {
    throw new Error(`${moduleName} must be available in CI.`);
  }
  return (loadable ? describe : describe.skip) as typeof describe;
}

export const describeMySql = gatedDescribe(mysqlConfigured, 'MySQL');
export const describePostgres = gatedDescribe(postgresConfigured, 'PostgreSQL');
export const describeFirestore = gatedDescribe(firestoreEmulatorConfigured, 'Firestore emulator');

function readMySqlSettings(): MySqlSettings {
  return {
    host: process.env.HARBOR_TEST_MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.HARBOR_TEST_MYSQL_PORT ?? 3306),
    user: process.env.HARBOR_TEST_MYSQL_USER ?? 'root',
    password: process.env.HARBOR_TEST_MYSQL_PASSWORD ?? 'harborclient',
    database: process.env.HARBOR_TEST_MYSQL_DATABASE ?? 'harborclient_test'
  };
}

function readPostgresSettings(): PostgresSettings {
  return {
    host: process.env.HARBOR_TEST_POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.HARBOR_TEST_POSTGRES_PORT ?? 5432),
    user: process.env.HARBOR_TEST_POSTGRES_USER ?? 'postgres',
    password: process.env.HARBOR_TEST_POSTGRES_PASSWORD ?? 'harborclient',
    database: process.env.HARBOR_TEST_POSTGRES_DATABASE ?? 'harborclient_test'
  };
}

export const TEST_FIRESTORE_SETTINGS: FirestoreSettings = {
  apiKey: 'fake-api-key',
  authDomain: 'localhost',
  projectId: 'demo-harborclient-test',
  appId: '1:123456789:web:abc123',
  email: 'test@example.com',
  password: 'password123'
};

async function truncateMySqlTables(settings: MySqlSettings): Promise<void> {
  const connection = await mysql.createConnection({
    host: settings.host,
    port: settings.port,
    user: settings.user,
    password: settings.password,
    database: settings.database
  });
  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE requests');
    await connection.execute('TRUNCATE TABLE documents');
    await connection.execute('TRUNCATE TABLE folders');
    await connection.execute('TRUNCATE TABLE collections');
    await connection.execute('TRUNCATE TABLE environments');
    await connection.execute('TRUNCATE TABLE settings');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }
}

async function truncatePostgresTables(settings: PostgresSettings): Promise<void> {
  const pool = new Pool({
    host: settings.host,
    port: settings.port,
    user: settings.user,
    password: settings.password,
    database: settings.database
  });
  try {
    await pool.query(`
      TRUNCATE TABLE requests, documents, folders, collections, environments, settings
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await pool.end();
  }
}

let sharedMySqlDb: MySqlStorage | null = null;
let sharedPostgresDb: PostgresStorage | null = null;
let sharedFirestoreDb: FirestoreStorage | null = null;

/**
 * Creates a MySQL test database handle with table truncation between tests.
 */
export function createMySqlTestDbFactory(): CreateTestDb {
  return async () => {
    const settings = readMySqlSettings();
    if (!sharedMySqlDb) {
      sharedMySqlDb = new MySqlStorage(settings);
      await sharedMySqlDb.init();
    }
    await truncateMySqlTables(settings);
    return {
      db: sharedMySqlDb,
      cleanup: async () => {
        await truncateMySqlTables(settings);
      }
    };
  };
}

/**
 * Creates a PostgreSQL test database handle with table truncation between tests.
 */
export function createPostgresTestDbFactory(): CreateTestDb {
  return async () => {
    const settings = readPostgresSettings();
    if (!sharedPostgresDb) {
      sharedPostgresDb = new PostgresStorage(settings);
      await sharedPostgresDb.init();
    }
    await truncatePostgresTables(settings);
    return {
      db: sharedPostgresDb,
      cleanup: async () => {
        await truncatePostgresTables(settings);
      }
    };
  };
}

/**
 * Creates a Firestore emulator test database handle.
 */
export function createFirestoreTestDbFactory(): CreateTestDb {
  return async () => {
    if (!sharedFirestoreDb) {
      const db = new FirestoreStorage(TEST_FIRESTORE_SETTINGS);
      try {
        await db.init();
        sharedFirestoreDb = db;
      } catch (err) {
        await db.close().catch(() => {});
        throw err;
      }
    }

    const db = sharedFirestoreDb;
    for (const collection of await db.listCollections()) {
      await db.deleteCollection(collection.id);
    }
    for (const environment of await db.listEnvironments()) {
      await db.deleteEnvironment(environment.id);
    }

    return {
      db,
      cleanup: async () => {
        for (const collection of await db.listCollections()) {
          await db.deleteCollection(collection.id);
        }
        for (const environment of await db.listEnvironments()) {
          await db.deleteEnvironment(environment.id);
        }
      }
    };
  };
}

/**
 * Closes shared SQL backend pools after all tests in a file complete.
 */
export async function closeSharedSqlBackends(): Promise<void> {
  if (sharedMySqlDb) {
    await sharedMySqlDb.close();
    sharedMySqlDb = null;
  }
  if (sharedPostgresDb) {
    await sharedPostgresDb.close();
    sharedPostgresDb = null;
  }
  if (sharedFirestoreDb) {
    await sharedFirestoreDb.close();
    sharedFirestoreDb = null;
  }
}
