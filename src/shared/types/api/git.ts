import type {
  GitCommitDetail,
  GitGraphLogResult,
  GitIdentity,
  GitLogEntry,
  GitOAuthFinishedEvent,
  GitRequestDiffResult,
  GitRequestFileStatus,
  SourceControlStatus
} from '#/shared/types/storage';

/**
 * IPC methods for git.
 */
export interface ApiGit {
  /**
   * Returns source-control status for each mounted git-backed connection.
   */
  listGitStatuses: () => Promise<Record<string, SourceControlStatus>>;
  /**
   * Subscribes to working-tree changes for git-backed connections (pull, external edits).
   *
   * @param callback - Handler invoked with the connection id whose tree changed.
   * @returns Unsubscribe function.
   */
  onGitWorkingTreeChanged: (callback: (connectionId: string) => void) => () => void;
  /**
   * Subscribes to background GitHub OAuth completion for a git-backed connection.
   *
   * @param callback - Handler invoked when OAuth polling finishes or fails.
   * @returns Unsubscribe function.
   */
  onGitOAuthFinished: (callback: (event: GitOAuthFinishedEvent) => void) => () => void;
  /**
   * Stages all changes and commits in a git-backed connection working tree.
   *
   * @param connectionId - Git connection id.
   * @param message - Commit message.
   * @param createHarborRoot - When true, creates the HarborClient subdirectory layout if missing.
   */
  gitCommit: (connectionId: string, message: string, createHarborRoot?: boolean) => Promise<void>;
  /**
   * Returns per-request git status for requests in one git-backed collection.
   *
   * @param args - Git connection id and collection uuid.
   */
  gitRequestStatuses: (args: {
    connectionId: string;
    collectionUuid: string;
  }) => Promise<Record<string, GitRequestFileStatus>>;
  /**
   * Stages working-tree changes for one request in a git-backed collection.
   *
   * @param args - Git connection id, collection uuid, and request uuid.
   */
  gitAddRequest: (args: {
    connectionId: string;
    collectionUuid: string;
    requestUuid: string;
  }) => Promise<void>;
  /**
   * Unstages staged changes for one request in a git-backed collection.
   *
   * @param args - Git connection id, collection uuid, and request uuid.
   */
  gitRemoveRequest: (args: {
    connectionId: string;
    collectionUuid: string;
    requestUuid: string;
  }) => Promise<void>;
  /**
   * Returns local branch names for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitListBranches: (connectionId: string) => Promise<string[]>;
  /**
   * Creates a new branch from the current commit and checks it out.
   *
   * @param connectionId - Git connection id.
   * @param name - Branch name to create.
   */
  gitCreateBranch: (connectionId: string, name: string) => Promise<void>;
  /**
   * Checks out an existing local branch when the working tree is clean.
   *
   * @param connectionId - Git connection id.
   * @param name - Branch name to check out.
   */
  gitCheckoutBranch: (connectionId: string, name: string) => Promise<void>;
  /**
   * Pulls (fetch + merge) for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitPull: (connectionId: string) => Promise<void>;
  /**
   * Pushes commits to the remote for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   */
  gitPush: (connectionId: string) => Promise<void>;
  /**
   * Returns recent commits for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @param depth - Maximum number of commits to return.
   */
  gitLog: (connectionId: string, depth?: number) => Promise<GitLogEntry[]>;
  /**
   * Returns graph-ready commit history for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @param depth - Maximum number of commits to include.
   */
  gitGraphLog: (connectionId: string, depth?: number) => Promise<GitGraphLogResult>;
  /**
   * Returns detailed metadata and changed files for one commit.
   *
   * @param connectionId - Git connection id.
   * @param oid - Commit object id.
   */
  gitCommitDetail: (connectionId: string, oid: string) => Promise<GitCommitDetail>;
  /**
   * Returns a parent-to-commit diff for one request or document in a commit.
   *
   * @param args - Git connection id, commit oid, collection uuid, resource uuid, and kind.
   */
  gitCommitResourceDiff: (args: {
    connectionId: string;
    oid: string;
    collectionUuid: string;
    resourceUuid: string;
    kind: 'request' | 'document';
  }) => Promise<GitRequestDiffResult>;
  /**
   * Returns a working-tree diff for one request in a git-backed collection.
   *
   * @param args - Git connection id, collection uuid, and request uuid.
   */
  gitRequestDiff: (args: {
    connectionId: string;
    collectionUuid: string;
    requestUuid: string;
  }) => Promise<GitRequestDiffResult>;
  /**
   * Discards working-tree and staged changes for one request.
   *
   * @param args - Git connection id, collection uuid, and request uuid.
   */
  gitRevertRequest: (args: {
    connectionId: string;
    collectionUuid: string;
    requestUuid: string;
  }) => Promise<void>;
  /**
   * Returns per-document git status for documents in one git-backed collection.
   *
   * @param args - Git connection id and collection uuid.
   */
  gitDocumentStatuses: (args: {
    connectionId: string;
    collectionUuid: string;
  }) => Promise<Record<string, GitRequestFileStatus>>;
  /**
   * Stages working-tree changes for one markdown document in a git-backed collection.
   *
   * @param args - Git connection id, collection uuid, and document uuid.
   */
  gitAddDocument: (args: {
    connectionId: string;
    collectionUuid: string;
    documentUuid: string;
  }) => Promise<void>;
  /**
   * Unstages staged changes for one markdown document in a git-backed collection.
   *
   * @param args - Git connection id, collection uuid, and document uuid.
   */
  gitRemoveDocument: (args: {
    connectionId: string;
    collectionUuid: string;
    documentUuid: string;
  }) => Promise<void>;
  /**
   * Returns a working-tree diff for one markdown document in a git-backed collection.
   *
   * @param args - Git connection id, collection uuid, and document uuid.
   */
  gitDocumentDiff: (args: {
    connectionId: string;
    collectionUuid: string;
    documentUuid: string;
  }) => Promise<GitRequestDiffResult>;
  /**
   * Discards working-tree and staged changes for one markdown document.
   *
   * @param args - Git connection id, collection uuid, and document uuid.
   */
  gitRevertDocument: (args: {
    connectionId: string;
    collectionUuid: string;
    documentUuid: string;
  }) => Promise<void>;
  /**
   * Returns uncommitted HarborClient-tree diffs for a git-backed collection.
   *
   * @param args - Collection uuid and optional diff output caps.
   */
  gitDiff: (args: {
    collectionUuid: string;
    maxFiles?: number;
    maxCharsPerFile?: number;
    maxTotalChars?: number;
  }) => Promise<string>;
  /**
   * Stores a PAT for a git-backed connection and validates credentials via fetch.
   *
   * @param connectionId - Git connection id.
   * @param username - Basic Auth username.
   * @param token - Personal access token.
   */
  gitSetPat: (connectionId: string, username: string, token: string) => Promise<void>;
  /**
   * Starts GitHub OAuth device flow for a git-backed connection.
   *
   * @param connectionId - Git connection id.
   * @returns Device flow code and verification URL for the user to approve in a browser.
   */
  gitStartOAuth: (connectionId: string) => Promise<{ userCode: string; verificationUri: string }>;
  /**
   * Completes GitHub OAuth device flow after the user approves in a browser.
   *
   * Ensures background polling is running when a pending device flow exists.
   * Resolves immediately without waiting for GitHub approval.
   *
   * @param connectionId - Git connection id.
   */
  gitCompleteOAuth: (connectionId: string) => Promise<void>;
  /**
   * Removes stored GitHub OAuth tokens and resets auth metadata for a git connection.
   *
   * @param connectionId - Git connection id.
   */
  gitRevokeOAuth: (connectionId: string) => Promise<void>;
  /**
   * Reads the origin remote URL from a local git repository path.
   *
   * SSH remotes are normalized to HTTPS. Returns null when the path is not a git
   * repository or has no configured remotes.
   *
   * @param repoPath - Absolute path to a local git working tree.
   */
  gitReadRemoteUrl: (repoPath: string) => Promise<string | null>;
  /**
   * Lists saved git host identities.
   */
  listGitIdentities: () => Promise<GitIdentity[]>;
  /**
   * Stores a PAT for a git host and optionally validates credentials.
   *
   * @param host - Normalized lowercase git host key.
   * @param username - Basic Auth username.
   * @param token - Personal access token.
   * @param testUrl - Optional repository URL used to validate the token.
   * @param repoPath - Optional local repository path used with testUrl.
   */
  gitSetHostPat: (
    host: string,
    username: string,
    token: string,
    testUrl?: string,
    repoPath?: string
  ) => Promise<void>;
  /**
   * Starts GitHub OAuth device flow for a git host.
   *
   * @param host - Normalized lowercase git host key.
   * @param testUrl - Optional repository URL used to validate after completion.
   * @param repoPath - Optional local repository path used with testUrl.
   */
  gitStartHostOAuth: (
    host: string,
    testUrl?: string,
    repoPath?: string
  ) => Promise<{ userCode: string; verificationUri: string }>;
  /**
   * Revokes stored credentials for a git host.
   *
   * @param host - Normalized lowercase git host key.
   */
  gitRevokeHost: (host: string) => Promise<void>;
  /**
   * Returns whether a directory path is the root of a git working tree.
   *
   * @param repoPath - Absolute directory path to inspect.
   */
  gitIsRepo: (repoPath: string) => Promise<boolean>;
  /**
   * Initializes a git repository and optionally adds an origin remote.
   *
   * @param repoPath - Absolute directory path to initialize.
   * @param url - HTTPS remote URL for origin, or empty to skip.
   * @param branch - Default branch name.
   */
  gitInitRepo: (repoPath: string, url: string, branch: string) => Promise<void>;
}
