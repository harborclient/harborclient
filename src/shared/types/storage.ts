/**
 * Active database backend for collections and requests.
 */
export type StorageProvider = 'sqlite' | 'firestore' | 'mysql' | 'postgres' | 'git';

/**
 * Kind of collection data provider, including remote team hubs.
 */
export type CollectionProviderKind = StorageProvider | 'team-hub';

/**
 * Firebase Firestore connection settings.
 */
export interface FirestoreSettings {
  /**
   * Firebase Web API key.
   */
  apiKey: string;

  /**
   * Firebase Auth domain.
   */
  authDomain: string;

  /**
   * Firebase project ID.
   */
  projectId: string;

  /**
   * Firebase app ID.
   */
  appId: string;

  /**
   * Email for Firebase Auth sign-in.
   */
  email: string;

  /**
   * Password for Firebase Auth sign-in.
   */
  password: string;
}

/**
 * MySQL connection settings.
 */
export interface MySqlSettings {
  /**
   * MySQL server hostname.
   */
  host: string;

  /**
   * MySQL server port.
   */
  port: number;

  /**
   * MySQL username.
   */
  user: string;

  /**
   * MySQL password.
   */
  password: string;

  /**
   * MySQL database name.
   */
  database: string;
}

/**
 * PostgreSQL connection settings.
 */
export interface PostgresSettings {
  /**
   * PostgreSQL server hostname.
   */
  host: string;

  /**
   * PostgreSQL server port.
   */
  port: number;

  /**
   * PostgreSQL username.
   */
  user: string;

  /**
   * PostgreSQL password.
   */
  password: string;

  /**
   * PostgreSQL database name.
   */
  database: string;
}

/**
 * How a git-backed connection authenticates for HTTPS fetch/push.
 */
export type GitAuthMethod =
  | {
      /**
       * Personal access token entered by the user.
       */
      kind: 'pat';

      /**
       * Username for Basic Auth (often the account name or `token` on GitHub).
       */
      username: string;
    }
  | {
      /**
       * OAuth token obtained via device flow.
       */
      kind: 'oauth';

      /**
       * OAuth provider that issued the token.
       */
      provider: 'github';
    };

/**
 * Settings for a git-backed collection provider.
 */
export interface GitSettings {
  /**
   * Absolute path to the repository root on disk.
   */
  repoPath: string;

  /**
   * HTTPS clone URL used for fetch and push.
   */
  url: string;

  /**
   * Branch to track (for example `main`).
   */
  branch: string;

  /**
   * Subdirectory within the repo where HarborClient files live.
   */
  subdir: string;

  /**
   * Optional GitHub OAuth App client id; falls back to the built-in app when empty.
   */
  oauthClientId?: string;

  /**
   * Authentication method metadata; secrets are stored separately via secretStorage.
   */
  auth: GitAuthMethod;
}

/**
 * Shared git credentials and auth metadata for a remote host.
 */
export interface GitIdentity {
  /**
   * Normalized lowercase hostname (for example `github.com`).
   */
  host: string;

  /**
   * Authentication method metadata; secrets are stored separately by host.
   */
  auth: GitAuthMethod;

  /**
   * Optional GitHub OAuth App client id override for this host.
   */
  oauthClientId?: string;

  /**
   * Whether encrypted credentials are stored for this host.
   * Populated when listing identities from the main process.
   */
  hasCredentials?: boolean;
}

/**
 * Source-control status for a git-backed provider working tree.
 */
export interface SourceControlStatus {
  /**
   * Count of staged, unstaged, and untracked changes in the working tree.
   */
  changedCount: number;

  /**
   * Current branch name, or null when not on a branch.
   */
  branch: string | null;

  /**
   * Commits ahead of the tracked upstream branch.
   */
  ahead: number;

  /**
   * Commits behind the tracked upstream branch.
   */
  behind: number;

  /**
   * Whether ahead/behind were computed from a cached origin tracking ref.
   * When false, counts are placeholders and the working tree may not be in sync.
   */
  syncKnown: boolean;

  /**
   * Number of files containing unresolved git merge conflict markers.
   */
  conflictCount: number;

  /**
   * Whether the configured HarborClient subdirectory exists on disk.
   */
  harborRootExists: boolean;

  /**
   * Configured HarborClient subdirectory relative to the repository root.
   */
  harborSubdir: string;
}

/**
 * Result of background GitHub OAuth device-flow completion.
 */
export interface GitOAuthFinishedEvent {
  /**
   * Normalized git host that finished OAuth.
   */
  host: string;

  /**
   * Legacy git connection id when OAuth was started from a connection-scoped flow.
   */
  connectionId?: string;

  /**
   * Whether authorization completed and credentials were validated.
   */
  ok: boolean;

  /**
   * Error message when {@link GitOAuthFinishedEvent.ok} is false.
   */
  error?: string;
}

/**
 * A single entry in the git commit log.
 */
export interface GitLogEntry {
  /**
   * Commit object id (full or abbreviated hash).
   */
  oid: string;

  /**
   * First line of the commit message.
   */
  message: string;

  /**
   * Commit author name.
   */
  author: string;

  /**
   * ISO 8601 commit timestamp.
   */
  timestamp: string;
}

/**
 * Configurable SQLite database path and legacy migration settings.
 */
export interface SqliteSettings {
  /**
   * Filename of the primary database file within userData.
   */
  dbFilename: string;

  /**
   * Filename of the legacy database file used for migration.
   */
  legacyDbFilename: string;

  /**
   * Legacy application data directory name under appData.
   */
  legacyUserDataDir: string;
}

/**
 * Shared fields for a named database connection.
 */
export interface StorageConnectionBase {
  /**
   * Unique connection identifier.
   */
  id: string;

  /**
   * User-defined display name.
   */
  name: string;

  /**
   * When true, startup git reconcile skips auto-adding sidebar entries for this provider.
   */
  collectionDiscoverySkipped?: boolean;
}

/**
 * A collection found on a provider that is not yet registered in the sidebar.
 */
export interface DiscoveredCollection {
  /**
   * Provider-local collection id.
   */
  providerCollectionId: number;

  /**
   * Display name from the provider.
   */
  name: string;

  /**
   * Stable collection uuid when available from the provider.
   */
  uuid: string;
}

/**
 * Result of registering selected discovered collections.
 */
export interface RegisterDiscoveredCollectionsResult {
  /**
   * Number of collections added to the sidebar registry.
   */
  added: number;
}

/**
 * A named database connection with type-specific settings.
 */
export type StorageConnection =
  | (StorageConnectionBase & { type: 'sqlite'; settings: SqliteSettings })
  | (StorageConnectionBase & { type: 'firestore'; settings: FirestoreSettings })
  | (StorageConnectionBase & { type: 'mysql'; settings: MySqlSettings })
  | (StorageConnectionBase & { type: 'postgres'; settings: PostgresSettings })
  | (StorageConnectionBase & { type: 'git'; settings: GitSettings });
