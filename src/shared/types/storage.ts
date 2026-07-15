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
   * Cached GitHub username (`login`) when credentials belong to github.com.
   * Populated after OAuth/PAT save or when listing identities.
   */
  githubLogin?: string;

  /**
   * Whether encrypted credentials are stored for this host.
   * Populated when listing identities from the main process.
   */
  hasCredentials?: boolean;
}

/**
 * Sidebar display state for one git-backed request file.
 */
export type GitRequestDisplayStatus = 'clean' | 'staged' | 'uncommitted' | 'unstaged';

/**
 * Per-request git status used by sidebar labels, colors, and context menus.
 */
export interface GitRequestFileStatus {
  /**
   * Highest-priority display state for the request name color.
   */
  displayStatus: GitRequestDisplayStatus;

  /**
   * Whether the request has unstaged or untracked changes that can be staged.
   */
  canAdd: boolean;

  /**
   * Whether the request has staged changes that can be unstaged.
   */
  canRemove: boolean;

  /**
   * Whether the backing file is new and not yet tracked in git.
   */
  isUntracked: boolean;
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
   * Count of files with staged changes ready for commit.
   */
  stagedCount: number;

  /**
   * Count of files with unstaged or untracked working-tree changes.
   */
  unstagedCount: number;

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
   * Whether authorization completed and credentials were stored.
   */
  ok: boolean;

  /**
   * Error message when {@link GitOAuthFinishedEvent.ok} is false.
   */
  error?: string;

  /**
   * Error message when authorization succeeded but optional repository
   * validation failed.
   */
  validationError?: string;

  /**
   * True when credentials were validated and the remote has no branch refs yet.
   */
  emptyRemote?: boolean;

  /**
   * True when GitHub granted push access; false when credentials are read-only.
   */
  canPush?: boolean;
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

  /**
   * Whether this commit is present on the tracked origin branch ref.
   * `true` when at or behind origin; `false` when ahead (unpushed).
   * Omitted when the origin tracking ref is unavailable (`syncKnown` is false).
   */
  pushedToOrigin?: boolean;
}

/**
 * Enriched commit entry for git graph visualization.
 */
export interface GitGraphLogEntry {
  /**
   * Commit object id.
   */
  hash: string;

  /**
   * Branch label used by the graph renderer for this commit.
   */
  branch: string;

  /**
   * Parent commit object ids.
   */
  parents: string[];

  /**
   * First line of the commit message.
   */
  message: string;

  /**
   * ISO 8601 committer timestamp.
   */
  committerDate: string;

  /**
   * Commit author metadata when available.
   */
  author?: {
    name: string;
    email: string;
  };
}

/**
 * Git log payload with branch heads for graph rendering.
 */
export interface GitGraphLogResult {
  /**
   * Commits formatted for graph visualization.
   */
  entries: GitGraphLogEntry[];

  /**
   * Currently checked-out branch name, if any.
   */
  currentBranch: string | null;

  /**
   * Object id of the current branch HEAD commit.
   */
  headCommitHash: string | null;
}

/**
 * Change type for one HarborClient file in a commit compared to its parent.
 */
export type GitCommitChangeStatus = 'added' | 'modified' | 'deleted';

/**
 * One non-resource HarborClient file changed in a commit.
 */
export interface GitCommitPlainFileChange {
  /**
   * Discriminator for plain file rows.
   */
  kind: 'file';

  /**
   * Repository-relative path under the HarborClient tree.
   */
  path: string;

  /**
   * Change type relative to the parent commit.
   */
  status: GitCommitChangeStatus;

  /**
   * User-facing request or document name when resolved from commit contents.
   */
  displayName?: string;

  /**
   * HarborClient resource kind for request and document rows.
   */
  resourceKind?: 'request' | 'document';

  /**
   * HTTP method for request rows when resolved from commit contents.
   */
  method?: string;
}

/**
 * One request resource changed in a commit, grouped across related paths.
 */
export interface GitCommitRequestChange {
  /**
   * Discriminator for request rows.
   */
  kind: 'request';

  /**
   * Primary repository-relative path used for sorting and display fallbacks.
   */
  path: string;

  /**
   * All repository-relative paths that changed for this request in the commit.
   */
  paths: string[];

  /**
   * Aggregated change type across all paths for this request.
   */
  status: GitCommitChangeStatus;

  /**
   * Stable collection uuid owning the request.
   */
  collectionUuid: string;

  /**
   * Stable request uuid.
   */
  requestUuid: string;

  /**
   * Request display name at commit time.
   */
  name: string;

  /**
   * HTTP method at commit time.
   */
  method: string;

  /**
   * Optional sidebar color at commit time.
   */
  color?: string | null;
}

/**
 * One markdown document resource changed in a commit, grouped across related paths.
 */
export interface GitCommitDocumentChange {
  /**
   * Discriminator for document rows.
   */
  kind: 'document';

  /**
   * Primary repository-relative path used for sorting and display fallbacks.
   */
  path: string;

  /**
   * All repository-relative paths that changed for this document in the commit.
   */
  paths: string[];

  /**
   * Aggregated change type across all paths for this document.
   */
  status: GitCommitChangeStatus;

  /**
   * Stable collection uuid owning the document.
   */
  collectionUuid: string;

  /**
   * Stable document uuid.
   */
  documentUuid: string;

  /**
   * Document display name at commit time.
   */
  name: string;

  /**
   * Optional sidebar color at commit time.
   */
  color?: string | null;
}

/**
 * One HarborClient file or grouped request/document resource changed in a commit.
 */
export type GitCommitFileChange =
  | GitCommitPlainFileChange
  | GitCommitRequestChange
  | GitCommitDocumentChange;

/**
 * Detailed metadata and file list for one commit.
 */
export interface GitCommitDetail {
  /**
   * Commit object id.
   */
  oid: string;

  /**
   * First line of the commit message.
   */
  message: string;

  /**
   * Full commit message body.
   */
  fullMessage: string;

  /**
   * Commit author name.
   */
  author: string;

  /**
   * ISO 8601 commit timestamp.
   */
  timestamp: string;

  /**
   * Parent commit object ids.
   */
  parents: string[];

  /**
   * HarborClient-scoped files changed in this commit.
   */
  files: GitCommitFileChange[];
}

/**
 * One changed file in a request working-tree diff.
 */
export interface GitRequestDiffFileEntry {
  /**
   * Repository-relative path under the HarborClient subdirectory.
   */
  path: string;

  /**
   * Added, modified, or deleted relative to HEAD.
   */
  status: 'added' | 'modified' | 'deleted';

  /**
   * Unified-style diff excerpt when the file is text.
   */
  diff?: string;

  /**
   * Whether the file was treated as binary.
   */
  binary: boolean;

  /**
   * Whether this file's diff was truncated.
   */
  truncated: boolean;

  /**
   * Whether the working-tree file contains unresolved merge conflict markers.
   */
  hasConflict: boolean;

  /**
   * User-facing request or document name when resolved from file contents.
   */
  displayName?: string;

  /**
   * HarborClient resource kind for filtered Changes list rows.
   */
  resourceKind?: 'request' | 'document';

  /**
   * HTTP method for request rows when resolved from file contents.
   */
  method?: string;

  /**
   * Repository-relative paths removed during a rename, when this row represents a
   * collapsed delete+add pair for one request uuid.
   */
  previousPaths?: string[];

  /**
   * User-facing name from the deleted path during a rename, when resolved.
   */
  renamedFrom?: string;
}

/**
 * Diff payload for one request's git-tracked files.
 */
export interface GitRequestDiffResult {
  /**
   * Request display name when resolved from storage.
   */
  requestName: string;

  /**
   * Changed files belonging to the request.
   */
  files: GitRequestDiffFileEntry[];

  /**
   * Error message when diff generation failed.
   */
  error?: string;
}

/**
 * One saved request or markdown document row in a git repo info payload.
 */
export interface GitRepoInfoItem {
  /**
   * Stable item uuid.
   */
  uuid: string;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * HarborClient resource kind for the on-disk file.
   */
  kind: 'request' | 'document';

  /**
   * Repository-relative file path.
   */
  repoPath: string;

  /**
   * HTTP method for request rows.
   */
  method?: string;
}

/**
 * Summary of one uncommitted file in a git repo info payload.
 */
export interface GitRepoInfoUncommittedFile {
  /**
   * Repository-relative file path.
   */
  path: string;

  /**
   * Added, modified, or deleted status.
   */
  status: string;
}

/**
 * Git repository metadata for one git-backed collection.
 */
export interface GitRepoInfoResult {
  /**
   * Git connection id for the collection.
   */
  connectionId: string;

  /**
   * Stable collection uuid.
   */
  collectionUuid: string;

  /**
   * Collection display name.
   */
  collectionName: string;

  /**
   * Normalized HTTPS remote url, when configured.
   */
  repoUrl: string | null;

  /**
   * Absolute repository root path on disk.
   */
  repoPath: string;

  /**
   * Absolute HarborClient data root inside the repository.
   */
  harborDataPath: string;

  /**
   * HarborClient subdirectory prefix within the repository.
   */
  harborSubdir: string;

  /**
   * Source-control status for the repository working tree.
   */
  status: SourceControlStatus;

  /**
   * Saved requests and markdown documents with repository-relative paths.
   */
  items: GitRepoInfoItem[];

  /**
   * Per-item git status for items with staged or unstaged changes.
   */
  uncommittedItems: Record<string, GitRequestFileStatus>;

  /**
   * Uncommitted file paths scoped to the collection folder.
   */
  uncommittedFiles: GitRepoInfoUncommittedFile[];

  /**
   * Error message when repo info could not be resolved.
   */
  error?: string;
}

/**
 * Commit history payload for one git-backed collection.
 */
export interface GitCommitsResult {
  /**
   * Git connection id for the collection.
   */
  connectionId: string;

  /**
   * Stable collection uuid.
   */
  collectionUuid: string;

  /**
   * Recent commits in the repository.
   */
  commits: GitLogEntry[];

  /**
   * Error message when commit history could not be resolved.
   */
  error?: string;
}

/**
 * Per-file git metadata for one saved request.
 */
export interface GitFileInfoResult {
  /**
   * Git connection id for the collection.
   */
  connectionId: string;

  /**
   * Stable collection uuid.
   */
  collectionUuid: string;

  /**
   * Stable request uuid.
   */
  requestUuid: string;

  /**
   * Repository-relative file path for the request.
   */
  repoPath: string;

  /**
   * Saved request metadata from storage.
   */
  request: {
    id: number;
    uuid: string;
    name: string;
    method: string;
    url: string;
    folder_id: number | null;
  };

  /**
   * Commits that touched the request file.
   */
  commitHistory: GitLogEntry[];

  /**
   * Error message when file info could not be resolved.
   */
  error?: string;
}

/**
 * Diff payload for one request file between two commits.
 */
export interface GitFileDiffResult {
  /**
   * Git connection id for the collection.
   */
  connectionId: string;

  /**
   * Stable collection uuid.
   */
  collectionUuid: string;

  /**
   * Stable request uuid.
   */
  requestUuid: string;

  /**
   * Request display name.
   */
  requestName: string;

  /**
   * Repository-relative file path.
   */
  repoPath: string;

  /**
   * Older commit object id, or null when the diff starts from an empty tree.
   */
  commitA: string | null;

  /**
   * Newer commit object id.
   */
  commitB: string;

  /**
   * Unified diff text, or null when binary or absent at both commits.
   */
  diff: string | null;

  /**
   * Whether the diff text was truncated.
   */
  truncated: boolean;

  /**
   * Whether either commit version is non-text content.
   */
  binary: boolean;

  /**
   * Original diff length before truncation, when truncated is true.
   */
  originalLength?: number;

  /**
   * Error message when the diff could not be generated.
   */
  error?: string;
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
