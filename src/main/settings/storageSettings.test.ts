import { afterEach, beforeEach, expect, it } from 'vitest';
import type { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import {
  isStorageConnectionConfigured,
  listStorageConnections,
  saveStorageConnection
} from '#/main/settings/storageSettings';
import type { StorageConnection, SqliteSettings } from '#/shared/types';

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
function sqliteConnection(settings: Partial<SqliteSettings> = {}): StorageConnection {
  return {
    id: 'sqlite',
    name: 'SQLite',
    type: 'sqlite',
    settings: { ...DEFAULT_SQLITE_SETTINGS, ...settings }
  };
}

it('treats default remote provider placeholders as unconfigured', () => {
  expect(
    isStorageConnectionConfigured({
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
    isStorageConnectionConfigured({
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
    isStorageConnectionConfigured({
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
  expect(isStorageConnectionConfigured(sqliteConnection())).toBe(true);
  expect(isStorageConnectionConfigured(sqliteConnection({ dbFilename: '  ' }))).toBe(false);
});

let settingsStore: Record<string, string>;

beforeEach(() => {
  settingsStore = {};
  const database = {
    getSetting: (key: string) => settingsStore[key],
    setSetting: (key: string, value: string) => {
      settingsStore[key] = value;
    }
  } as LocalDatabase;
  setLocalDatabaseForTesting(database);
});

afterEach(() => {
  clearLocalDatabaseForTesting();
});

it('normalizes git oauthClientId by trimming and dropping blank values', () => {
  saveStorageConnection({
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

  const withClientId = listStorageConnections().find((conn) => conn.id === 'git-1');
  expect(withClientId?.type === 'git' && withClientId.settings.oauthClientId).toBe('org-client-id');

  saveStorageConnection({
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

  const withoutClientId = listStorageConnections().find((conn) => conn.id === 'git-2');
  expect(withoutClientId?.type === 'git' && withoutClientId.settings.oauthClientId).toBeUndefined();
});

it('preserves a blank git subdir so data is stored at the repository root', () => {
  saveStorageConnection({
    id: 'git-root',
    name: 'Git Root',
    type: 'git',
    settings: {
      repoPath: '/tmp/repo',
      url: 'https://github.com/example/repo.git',
      branch: 'main',
      subdir: '',
      auth: { kind: 'pat', username: 'token' }
    }
  });

  const rootConn = listStorageConnections().find((conn) => conn.id === 'git-root');
  expect(rootConn?.type === 'git' && rootConn.settings.subdir).toBe('');
});
