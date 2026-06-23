import { afterEach, beforeEach, expect, it } from 'vitest';
import type { LocalRegistry } from '#/main/db/LocalRegistry';
import {
  clearLocalRegistryForTesting,
  setLocalRegistryForTesting
} from '#/main/db/localRegistryInstance';
import {
  isDatabaseConnectionConfigured,
  listDatabaseConnections,
  saveDatabaseConnection
} from '#/main/settings/databaseSettings';
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

let settingsStore: Record<string, string>;

beforeEach(() => {
  settingsStore = {};
  const registry = {
    getSetting: (key: string) => settingsStore[key],
    setSetting: (key: string, value: string) => {
      settingsStore[key] = value;
    }
  } as LocalRegistry;
  setLocalRegistryForTesting(registry);
});

afterEach(() => {
  clearLocalRegistryForTesting();
});

it('normalizes git oauthClientId by trimming and dropping blank values', () => {
  saveDatabaseConnection({
    id: 'git-1',
    name: 'Git',
    type: 'git',
    settings: {
      repoPath: '/tmp/repo',
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      oauthClientId: '  org-client-id  ',
      auth: { kind: 'pat', username: 'token' }
    }
  });

  const withClientId = listDatabaseConnections().find((conn) => conn.id === 'git-1');
  expect(withClientId?.type === 'git' && withClientId.settings.oauthClientId).toBe('org-client-id');

  saveDatabaseConnection({
    id: 'git-2',
    name: 'Git Blank',
    type: 'git',
    settings: {
      repoPath: '/tmp/repo',
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '.harborclient',
      oauthClientId: '   ',
      auth: { kind: 'pat', username: 'token' }
    }
  });

  const withoutClientId = listDatabaseConnections().find((conn) => conn.id === 'git-2');
  expect(withoutClientId?.type === 'git' && withoutClientId.settings.oauthClientId).toBeUndefined();
});
