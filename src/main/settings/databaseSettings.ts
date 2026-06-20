import { randomUUID } from 'crypto';
import Store from 'electron-store';
import type {
  DatabaseConnection,
  DatabaseProvider,
  FirestoreSettings,
  MySqlSettings,
  PostgresSettings,
  SqliteSettings
} from '#/shared/types';

const DEFAULT_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

const DEFAULT_FIRESTORE_SETTINGS: FirestoreSettings = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  email: '',
  password: ''
};

const DEFAULT_MYSQL_SETTINGS: MySqlSettings = {
  host: '127.0.0.1',
  port: 3306,
  user: '',
  password: '',
  database: ''
};

const DEFAULT_POSTGRES_SETTINGS: PostgresSettings = {
  host: '127.0.0.1',
  port: 5432,
  user: '',
  password: '',
  database: ''
};

type LegacySettingsStore = {
  provider?: DatabaseProvider;
  sqlite?: SqliteSettings;
  firestore?: FirestoreSettings;
  mysql?: MySqlSettings;
  postgres?: PostgresSettings;
  databaseConnections?: DatabaseConnection[];
  activeDatabaseId?: string;
};

let store: Store<LegacySettingsStore> | null = null;

/**
 * Returns the lazy electron-store instance for database connection settings.
 */
function getStore(): Store<LegacySettingsStore> {
  if (!store) {
    store = new Store<LegacySettingsStore>({
      name: 'settings'
    });
  }
  return store;
}

/**
 * Normalizes a SQLite settings field, falling back to the default when blank.
 *
 * @param value - Raw field value from storage or input.
 * @param fallback - Default when value is empty after trim.
 */
function normalizeSqliteField(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

/**
 * Normalizes SQLite settings with defaults for blank fields.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeSqliteSettings(input: Partial<SqliteSettings>): SqliteSettings {
  return {
    dbFilename: normalizeSqliteField(input.dbFilename ?? '', DEFAULT_SQLITE_SETTINGS.dbFilename),
    legacyDbFilename: normalizeSqliteField(
      input.legacyDbFilename ?? '',
      DEFAULT_SQLITE_SETTINGS.legacyDbFilename
    ),
    legacyUserDataDir: normalizeSqliteField(
      input.legacyUserDataDir ?? '',
      DEFAULT_SQLITE_SETTINGS.legacyUserDataDir
    )
  };
}

/**
 * Normalizes Firestore settings with trimmed fields.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeFirestoreSettings(input: Partial<FirestoreSettings>): FirestoreSettings {
  return {
    apiKey: input.apiKey?.trim() ?? '',
    authDomain: input.authDomain?.trim() ?? '',
    projectId: input.projectId?.trim() ?? '',
    appId: input.appId?.trim() ?? '',
    email: input.email?.trim() ?? '',
    password: input.password ?? ''
  };
}

/**
 * Normalizes MySQL settings with trimmed fields and a valid port.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeMySqlSettings(input: Partial<MySqlSettings>): MySqlSettings {
  const port = Number(input.port);
  return {
    host: input.host?.trim() ?? DEFAULT_MYSQL_SETTINGS.host,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_MYSQL_SETTINGS.port,
    user: input.user?.trim() ?? '',
    password: input.password ?? '',
    database: input.database?.trim() ?? ''
  };
}

/**
 * Normalizes PostgreSQL settings with trimmed fields and a valid port.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizePostgresSettings(input: Partial<PostgresSettings>): PostgresSettings {
  const port = Number(input.port);
  return {
    host: input.host?.trim() ?? DEFAULT_POSTGRES_SETTINGS.host,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_POSTGRES_SETTINGS.port,
    user: input.user?.trim() ?? '',
    password: input.password ?? '',
    database: input.database?.trim() ?? ''
  };
}

/**
 * Normalizes a database connection name.
 *
 * @param name - Raw connection name.
 * @returns Trimmed name or a default label.
 */
function normalizeConnectionName(name: string): string {
  const trimmed = name.trim();
  return trimmed || 'Untitled';
}

/**
 * Normalizes a database connection by type.
 *
 * @param conn - Raw connection from storage or user input.
 * @returns Normalized connection.
 */
function normalizeConnection(conn: DatabaseConnection): DatabaseConnection {
  const name = normalizeConnectionName(conn.name);
  const id = conn.id.trim() || randomUUID();

  switch (conn.type) {
    case 'sqlite':
      return { id, name, type: 'sqlite', settings: normalizeSqliteSettings(conn.settings) };
    case 'firestore':
      return { id, name, type: 'firestore', settings: normalizeFirestoreSettings(conn.settings) };
    case 'mysql':
      return { id, name, type: 'mysql', settings: normalizeMySqlSettings(conn.settings) };
    case 'postgres':
      return { id, name, type: 'postgres', settings: normalizePostgresSettings(conn.settings) };
  }
}

/**
 * Parses a legacy provider value.
 *
 * @param provider - Raw stored provider.
 * @returns Valid database provider.
 */
function parseLegacyProvider(provider: DatabaseProvider | undefined): DatabaseProvider {
  if (provider === 'firestore') return 'firestore';
  if (provider === 'mysql') return 'mysql';
  if (provider === 'postgres') return 'postgres';
  return 'sqlite';
}

/**
 * Creates default connections for each provider type.
 *
 * @param sqlite - Legacy SQLite settings.
 * @param firestore - Legacy Firestore settings.
 * @param mysql - Legacy MySQL settings.
 * @param postgres - Legacy PostgreSQL settings.
 * @returns Default connection list.
 */
function createDefaultConnections(
  sqlite: SqliteSettings,
  firestore: FirestoreSettings,
  mysql: MySqlSettings,
  postgres: PostgresSettings
): DatabaseConnection[] {
  return [
    normalizeConnection({ id: randomUUID(), name: 'SQLite', type: 'sqlite', settings: sqlite }),
    normalizeConnection({
      id: randomUUID(),
      name: 'Firestore',
      type: 'firestore',
      settings: firestore
    }),
    normalizeConnection({ id: randomUUID(), name: 'MySQL', type: 'mysql', settings: mysql }),
    normalizeConnection({
      id: randomUUID(),
      name: 'PostgreSQL',
      type: 'postgres',
      settings: postgres
    })
  ];
}

/**
 * Migrates legacy per-type settings into the connection list when needed.
 *
 * @returns Normalized connections and active id.
 */
function ensureConnectionsMigrated(): { connections: DatabaseConnection[]; activeId: string } {
  const settingsStore = getStore();
  const existing = settingsStore.get('databaseConnections');

  if (Array.isArray(existing) && existing.length > 0) {
    const connections = existing.map((conn) => normalizeConnection(conn));
    const activeId = settingsStore.get('activeDatabaseId', connections[0].id);
    const activeExists = connections.some((conn) => conn.id === activeId);
    const resolvedActiveId = activeExists
      ? activeId
      : (connections.find((conn) => conn.type === 'sqlite') ?? connections[0]).id;

    settingsStore.set('databaseConnections', connections);
    settingsStore.set('activeDatabaseId', resolvedActiveId);
    return { connections, activeId: resolvedActiveId };
  }

  const legacyProvider = parseLegacyProvider(settingsStore.get('provider'));
  const sqlite = normalizeSqliteSettings(
    settingsStore.get('sqlite', DEFAULT_SQLITE_SETTINGS) ?? DEFAULT_SQLITE_SETTINGS
  );
  const firestore = normalizeFirestoreSettings(
    settingsStore.get('firestore', DEFAULT_FIRESTORE_SETTINGS) ?? DEFAULT_FIRESTORE_SETTINGS
  );
  const mysql = normalizeMySqlSettings(
    settingsStore.get('mysql', DEFAULT_MYSQL_SETTINGS) ?? DEFAULT_MYSQL_SETTINGS
  );
  const postgres = normalizePostgresSettings(
    settingsStore.get('postgres', DEFAULT_POSTGRES_SETTINGS) ?? DEFAULT_POSTGRES_SETTINGS
  );

  const connections = createDefaultConnections(sqlite, firestore, mysql, postgres);
  const activeConnection =
    connections.find((conn) => conn.type === legacyProvider) ??
    connections.find((conn) => conn.type === 'sqlite') ??
    connections[0];

  settingsStore.set('databaseConnections', connections);
  settingsStore.set('activeDatabaseId', activeConnection.id);
  return { connections, activeId: activeConnection.id };
}

/**
 * Lists all configured database connections.
 *
 * @returns All persisted connections.
 */
export function listDatabaseConnections(): DatabaseConnection[] {
  return ensureConnectionsMigrated().connections;
}

/**
 * Returns the id of the active database connection.
 *
 * @returns Active connection id.
 */
export function getActiveDatabaseId(): string {
  return ensureConnectionsMigrated().activeId;
}

/**
 * Returns the active database connection.
 *
 * @returns Active connection configuration.
 */
export function getActiveDatabaseConnection(): DatabaseConnection {
  const { connections, activeId } = ensureConnectionsMigrated();
  const active = connections.find((conn) => conn.id === activeId);
  if (active) return active;
  return connections.find((conn) => conn.type === 'sqlite') ?? connections[0];
}

/**
 * Sets the active database connection id.
 *
 * @param id - Connection id to activate on next launch.
 */
export function setActiveDatabaseId(id: string): void {
  const connections = listDatabaseConnections();
  if (!connections.some((conn) => conn.id === id)) {
    throw new Error(`Unknown database connection: ${id}`);
  }
  getStore().set('activeDatabaseId', id);
}

/**
 * Creates or updates a database connection.
 *
 * @param input - Connection to persist; empty id inserts a new connection.
 * @returns Updated list of all connections.
 */
export function saveDatabaseConnection(input: DatabaseConnection): DatabaseConnection[] {
  const normalized = normalizeConnection(input);
  const connections = listDatabaseConnections();
  const index = connections.findIndex((conn) => conn.id === normalized.id);

  if (index >= 0) {
    connections[index] = normalized;
  } else {
    connections.push(normalized);
  }

  getStore().set('databaseConnections', connections);
  return connections;
}

/**
 * Returns SQLite settings from the first SQLite connection, or defaults.
 *
 * @returns SQLite settings for fallback initialization.
 */
export function getSqliteFallbackSettings(): SqliteSettings {
  const sqliteConnection = listDatabaseConnections().find((conn) => conn.type === 'sqlite');
  if (sqliteConnection?.type === 'sqlite') {
    return sqliteConnection.settings;
  }
  return normalizeSqliteSettings(DEFAULT_SQLITE_SETTINGS);
}

/**
 * Deletes a database connection by id.
 *
 * @param id - Connection id to remove.
 * @returns Updated list of all connections.
 */
export function deleteDatabaseConnection(id: string): DatabaseConnection[] {
  const connections = listDatabaseConnections();
  if (connections.length <= 1) {
    throw new Error('At least one database connection must remain.');
  }

  const nextConnections = connections.filter((conn) => conn.id !== id);
  if (nextConnections.length === connections.length) {
    throw new Error(`Unknown database connection: ${id}`);
  }

  getStore().set('databaseConnections', nextConnections);

  const activeId = getActiveDatabaseId();
  if (activeId === id) {
    const fallback =
      nextConnections.find((conn) => conn.type === 'sqlite') ?? nextConnections[0];
    getStore().set('activeDatabaseId', fallback.id);
  }

  return nextConnections;
}
