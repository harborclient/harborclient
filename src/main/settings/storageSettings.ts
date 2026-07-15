import { randomUUID } from 'crypto';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { assignSlotForNewConnection } from './storageSlots';
import type {
  StorageConnection,
  FirestoreSettings,
  GitSettings,
  MySqlSettings,
  PostgresSettings,
  SqliteSettings
} from '#/shared/types';
import { normalizeSqliteFilename } from './sqliteFilename';
import { parseJson } from '#/shared/parseJson';

const CONNECTIONS_KEY = 'storageConnections';
const ACTIVE_ID_KEY = 'activeStorageId';

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

const DEFAULT_GIT_SETTINGS: GitSettings = {
  repoPath: '',
  url: '',
  branch: 'main',
  subdir: '.harborclient',
  auth: { kind: 'pat', username: 'token' }
};

/**
 * Persists the connection list to the local registry.
 *
 * @param connections - Connections to store.
 */
function persistConnections(connections: StorageConnection[]): void {
  getLocalDatabase().setSetting(CONNECTIONS_KEY, JSON.stringify(connections));
}

/**
 * Persists the active connection id to the local registry.
 *
 * @param id - Active connection id.
 */
function persistActiveId(id: string): void {
  getLocalDatabase().setSetting(ACTIVE_ID_KEY, id);
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
    dbFilename: normalizeSqliteFilename(input.dbFilename ?? '', DEFAULT_SQLITE_SETTINGS.dbFilename),
    legacyDbFilename: normalizeSqliteFilename(
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
 * Trims an optional string field without substituting provider defaults.
 *
 * Missing values become empty strings; whitespace-only values trim to empty.
 *
 * @param value - Raw field value from storage or input.
 * @returns Trimmed string, or empty when absent.
 */
function trimOptionalString(value: string | undefined): string {
  return value?.trim() ?? '';
}

/**
 * Normalizes shared SQL connection settings with trimmed fields and a valid port.
 *
 * @param input - Raw settings from storage or user input.
 * @param defaults - Provider defaults for host and port.
 * @returns Normalized settings.
 */
function normalizeSqlConnectionSettings(
  input: Partial<MySqlSettings>,
  defaults: MySqlSettings
): MySqlSettings {
  const port = Number(input.port);
  return {
    host: input.host?.trim() ?? defaults.host,
    port: Number.isFinite(port) && port > 0 ? port : defaults.port,
    user: input.user?.trim() ?? '',
    password: input.password ?? '',
    database: input.database?.trim() ?? ''
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
    apiKey: trimOptionalString(input.apiKey),
    authDomain: trimOptionalString(input.authDomain),
    projectId: trimOptionalString(input.projectId),
    appId: trimOptionalString(input.appId),
    email: trimOptionalString(input.email),
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
  return normalizeSqlConnectionSettings(input, DEFAULT_MYSQL_SETTINGS);
}

/**
 * Normalizes PostgreSQL settings with trimmed fields and a valid port.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizePostgresSettings(input: Partial<PostgresSettings>): PostgresSettings {
  return normalizeSqlConnectionSettings(input, DEFAULT_POSTGRES_SETTINGS);
}

/**
 * Normalizes git connection settings with trimmed fields and defaults.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeGitSettings(input: Partial<GitSettings>): GitSettings {
  const auth = input.auth;
  const normalizedAuth =
    auth?.kind === 'oauth' && auth.provider === 'github'
      ? { kind: 'oauth' as const, provider: 'github' as const }
      : {
          kind: 'pat' as const,
          username: auth?.kind === 'pat' ? auth.username.trim() || 'token' : 'token'
        };

  return {
    repoPath: input.repoPath?.trim() ?? '',
    url: input.url?.trim() ?? '',
    branch: input.branch?.trim() || DEFAULT_GIT_SETTINGS.branch,
    // A provided-but-blank subdir means "store at the repository root", so only
    // fall back to the default when the field is entirely absent (`??`, not `||`).
    subdir: input.subdir?.trim() ?? DEFAULT_GIT_SETTINGS.subdir,
    oauthClientId: input.oauthClientId?.trim() || undefined,
    auth: normalizedAuth
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
function normalizeConnection(conn: StorageConnection): StorageConnection {
  const name = normalizeConnectionName(conn.name);
  const id = conn.id.trim() || randomUUID();
  const discoverySkipped =
    conn.collectionDiscoverySkipped === true
      ? ({ collectionDiscoverySkipped: true as const } satisfies Pick<
          StorageConnection,
          'collectionDiscoverySkipped'
        >)
      : {};

  switch (conn.type) {
    case 'sqlite':
      return {
        id,
        name,
        type: 'sqlite',
        settings: normalizeSqliteSettings(conn.settings),
        ...discoverySkipped
      };
    case 'firestore':
      return {
        id,
        name,
        type: 'firestore',
        settings: normalizeFirestoreSettings(conn.settings),
        ...discoverySkipped
      };
    case 'mysql':
      return {
        id,
        name,
        type: 'mysql',
        settings: normalizeMySqlSettings(conn.settings),
        ...discoverySkipped
      };
    case 'postgres':
      return {
        id,
        name,
        type: 'postgres',
        settings: normalizePostgresSettings(conn.settings),
        ...discoverySkipped
      };
    case 'git':
      return {
        id,
        name,
        type: 'git',
        settings: normalizeGitSettings(conn.settings),
        ...discoverySkipped
      };
  }
}

/**
 * Creates default connections for each provider type.
 *
 * @returns Default connection list.
 */
function createDefaultConnections(): StorageConnection[] {
  return [
    normalizeConnection({
      id: randomUUID(),
      name: 'SQLite',
      type: 'sqlite',
      settings: DEFAULT_SQLITE_SETTINGS
    }),
    normalizeConnection({
      id: randomUUID(),
      name: 'Firestore',
      type: 'firestore',
      settings: DEFAULT_FIRESTORE_SETTINGS
    }),
    normalizeConnection({
      id: randomUUID(),
      name: 'MySQL',
      type: 'mysql',
      settings: DEFAULT_MYSQL_SETTINGS
    }),
    normalizeConnection({
      id: randomUUID(),
      name: 'PostgreSQL',
      type: 'postgres',
      settings: DEFAULT_POSTGRES_SETTINGS
    })
  ];
}

/**
 * Ensures default connections exist in the local registry when empty.
 *
 * @returns Normalized connections and active id.
 */
function ensureConnectionsSeeded(): { connections: StorageConnection[]; activeId: string } {
  const database = getLocalDatabase();
  const stored = parseJson<StorageConnection[]>(database.getSetting(CONNECTIONS_KEY), []);

  if (stored.length > 0) {
    const connections = stored.map((conn) => normalizeConnection(conn));
    const activeId = database.getSetting(ACTIVE_ID_KEY) ?? connections[0].id;
    const activeExists = connections.some((conn) => conn.id === activeId);
    const resolvedActiveId = activeExists
      ? activeId
      : (connections.find((conn) => conn.type === 'sqlite') ?? connections[0]).id;

    persistConnections(connections);
    persistActiveId(resolvedActiveId);
    return { connections, activeId: resolvedActiveId };
  }

  const connections = createDefaultConnections();
  const activeConnection = connections.find((conn) => conn.type === 'sqlite') ?? connections[0];

  persistConnections(connections);
  persistActiveId(activeConnection.id);
  return { connections, activeId: activeConnection.id };
}

/**
 * Returns whether a connection has the minimum settings required to open a backend.
 *
 * Unconfigured placeholder connections (for example default Firestore/MySQL/PostgreSQL
 * rows on first launch) are kept in settings but must not block startup.
 *
 * @param connection - Normalized connection to evaluate.
 * @returns True when init should be attempted for this connection.
 */
export function isStorageConnectionConfigured(connection: StorageConnection): boolean {
  switch (connection.type) {
    case 'sqlite':
      return Boolean(connection.settings.dbFilename.trim());
    case 'firestore': {
      const { apiKey, authDomain, projectId, appId, email, password } = connection.settings;
      return Boolean(apiKey && authDomain && projectId && appId && email && password);
    }
    case 'mysql':
    case 'postgres': {
      const { host, user, database } = connection.settings;
      return Boolean(host && user && database);
    }
    case 'git': {
      const { repoPath, url } = connection.settings;
      return Boolean(repoPath && url);
    }
  }
}

/**
 * Lists all configured database connections.
 *
 * @returns All persisted connections.
 */
export function listStorageConnections(): StorageConnection[] {
  return ensureConnectionsSeeded().connections;
}

/**
 * Returns the id of the active database connection.
 *
 * @returns Active connection id.
 */
export function getActiveStorageId(): string {
  return ensureConnectionsSeeded().activeId;
}

/**
 * Returns the active database connection.
 *
 * @returns Active connection configuration.
 */
export function getActiveStorageConnection(): StorageConnection {
  const { connections, activeId } = ensureConnectionsSeeded();
  const active = connections.find((conn) => conn.id === activeId);
  if (active) return active;
  return connections.find((conn) => conn.type === 'sqlite') ?? connections[0];
}

/**
 * Sets the active database connection id.
 *
 * @param id - Connection id to activate on next launch.
 */
export function setActiveStorageId(id: string): void {
  const connections = listStorageConnections();
  if (!connections.some((conn) => conn.id === id)) {
    throw new Error(`Unknown database connection: ${id}`);
  }
  persistActiveId(id);
}

/**
 * Compares two flat settings objects for value equality.
 *
 * @param a - First settings object.
 * @param b - Second settings object.
 */
function settingsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

/**
 * Finds an existing connection with the same type and settings as the input.
 *
 * @param input - Connection to match; its id is ignored.
 * @returns The matching stored connection, or undefined when none match.
 */
export function findMatchingConnection(input: StorageConnection): StorageConnection | undefined {
  const normalized = normalizeConnection(input);
  return listStorageConnections().find(
    (conn) =>
      conn.type === normalized.type &&
      settingsEqual(
        conn.settings as unknown as Record<string, unknown>,
        normalized.settings as unknown as Record<string, unknown>
      )
  );
}

/**
 * Creates or updates a database connection.
 *
 * @param input - Connection to persist; empty id inserts a new connection.
 * @returns Updated list of all connections.
 */
export function saveStorageConnection(input: StorageConnection): StorageConnection[] {
  const normalized = normalizeConnection(input);
  const connections = listStorageConnections();
  const index = connections.findIndex((conn) => conn.id === normalized.id);

  if (index >= 0) {
    connections[index] = normalized;
  } else {
    connections.push(normalized);
    persistConnections(connections);
    assignSlotForNewConnection(normalized.id);
    return connections;
  }

  persistConnections(connections);
  return connections;
}

/**
 * Returns SQLite settings from the first SQLite connection, or defaults.
 *
 * @returns SQLite settings for fallback initialization.
 */
export function getSqliteFallbackSettings(): SqliteSettings {
  const sqliteConnection = listStorageConnections().find((conn) => conn.type === 'sqlite');
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
export function deleteStorageConnection(id: string): StorageConnection[] {
  const connections = listStorageConnections();
  if (connections.length <= 1) {
    throw new Error('At least one database connection must remain.');
  }

  const target = connections.find((conn) => conn.id === id);
  if (!target) {
    throw new Error(`Unknown database connection: ${id}`);
  }

  if (
    target.type === 'sqlite' &&
    connections.filter((conn) => conn.type === 'sqlite').length <= 1
  ) {
    throw new Error('At least one SQLite database connection must remain.');
  }

  const nextConnections = connections.filter((conn) => conn.id !== id);
  if (nextConnections.length === connections.length) {
    throw new Error(`Unknown database connection: ${id}`);
  }

  persistConnections(nextConnections);

  const activeId = getActiveStorageId();
  if (activeId === id) {
    const fallback = nextConnections.find((conn) => conn.type === 'sqlite') ?? nextConnections[0];
    persistActiveId(fallback.id);
  }

  return nextConnections;
}
