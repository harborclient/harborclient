import { expect, it } from 'vitest';
import { isDatabaseConnectionConfigured } from '#/main/settings/databaseSettings';
import type { DatabaseConnection, SqliteSettings } from '#/shared/types';

const DEFAULT_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

/**
 * Builds a minimal SQLite connection for configuration checks.
 *
 * @param settings - Optional overrides for SQLite settings fields.
 * @returns SQLite connection fixture.
 */
function sqliteConnection(settings: Partial<SqliteSettings> = {}): DatabaseConnection {
  return {
    id: 'sqlite',
    name: 'SQLite',
    type: 'sqlite',
    settings: { ...DEFAULT_SQLITE_SETTINGS, ...settings }
  };
}

it('treats default remote provider placeholders as unconfigured', () => {
  expect(
    isDatabaseConnectionConfigured({
      id: 'firestore',
      name: 'Firestore',
      type: 'firestore',
      settings: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        appId: '',
        email: '',
        password: ''
      }
    })
  ).toBe(false);

  expect(
    isDatabaseConnectionConfigured({
      id: 'mysql',
      name: 'MySQL',
      type: 'mysql',
      settings: {
        host: '127.0.0.1',
        port: 3306,
        user: '',
        password: '',
        database: ''
      }
    })
  ).toBe(false);
});

it('requires host, user, and database for SQL providers', () => {
  expect(
    isDatabaseConnectionConfigured({
      id: 'mysql',
      name: 'MySQL',
      type: 'mysql',
      settings: {
        host: 'db.example.com',
        port: 3306,
        user: 'app',
        password: 'secret',
        database: 'harbor'
      }
    })
  ).toBe(true);
});

it('requires a SQLite filename', () => {
  expect(isDatabaseConnectionConfigured(sqliteConnection())).toBe(true);
  expect(isDatabaseConnectionConfigured(sqliteConnection({ dbFilename: '  ' }))).toBe(false);
});
